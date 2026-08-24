import { error, fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import providers from "$lib/providers";
import { transformTPDBList } from "$lib/providers/parser";
import { logger } from "$lib/logger";
import { attachLibraryStates } from "$lib/server/library-state";

/**
 * Detail page for a TPDB title.
 *
 * This is deliberately separate from `/details/media/[id]/[mediaType]`, which is
 * built around TMDB's data model (seasons, episodes, external id resolution,
 * ratings aggregation). A TPDB record has none of that -- it has a site, a cast,
 * tags, a duration and a date -- so forcing it through the TMDB page would mean
 * a screen mostly made of empty sections.
 *
 * `type` is "movie" for a TPDB movie and "tv" for a scene, matching the mapping
 * used by the search endpoint.
 */
export const load: PageServerLoad = async ({ params, fetch, locals }) => {
    const { type, id } = params;

    if (type !== "movie" && type !== "tv") {
        error(400, "Invalid type");
    }

    const auth = {
        baseUrl: locals.backendUrl,
        headers: { "x-api-key": locals.apiKey },
        fetch
    };

    // openapi-fetch infers its response types from the literal path, so each
    // branch calls it directly rather than through a shared helper.
    const [detail, similar] =
        type === "movie"
            ? await Promise.all([
                  providers.riven.GET("/api/v1/tpdb/movies/{movie_id}", {
                      ...auth,
                      params: { path: { movie_id: id } }
                  }),
                  providers.riven.GET("/api/v1/tpdb/movies/{movie_id}/similar", {
                      ...auth,
                      params: { path: { movie_id: id } }
                  })
              ])
            : await Promise.all([
                  providers.riven.GET("/api/v1/tpdb/scenes/{scene_id}", {
                      ...auth,
                      params: { path: { scene_id: id } }
                  }),
                  providers.riven.GET("/api/v1/tpdb/scenes/{scene_id}/similar", {
                      ...auth,
                      params: { path: { scene_id: id } }
                  })
              ]);

    // A TPDB uuid names either a scene or a movie, and Riven stores both as
    // type "movie" -- so a scene reached from the library arrives here asking
    // for a movie and misses. Fall back to the other kind rather than 404-ing
    // a title that plainly exists.
    let resolved = detail.data ? detail : null;
    let resolvedType: "movie" | "tv" = type;
    let resolvedSimilar = similar.data ?? [];

    if (!resolved) {
        const otherType: "movie" | "tv" = type === "movie" ? "tv" : "movie";
        const [fallback, fallbackSimilar] =
            otherType === "movie"
                ? await Promise.all([
                      providers.riven.GET("/api/v1/tpdb/movies/{movie_id}", {
                          ...auth,
                          params: { path: { movie_id: id } }
                      }),
                      providers.riven.GET("/api/v1/tpdb/movies/{movie_id}/similar", {
                          ...auth,
                          params: { path: { movie_id: id } }
                      })
                  ])
                : await Promise.all([
                      providers.riven.GET("/api/v1/tpdb/scenes/{scene_id}", {
                          ...auth,
                          params: { path: { scene_id: id } }
                      }),
                      providers.riven.GET("/api/v1/tpdb/scenes/{scene_id}/similar", {
                          ...auth,
                          params: { path: { scene_id: id } }
                      })
                  ]);

        if (fallback.data) {
            resolved = fallback;
            resolvedType = otherType;
            resolvedSimilar = fallbackSimilar.data ?? [];
        }
    }

    if (!resolved?.data) {
        logger.error("TPDB detail fetch failed", detail.error);
        error(404, "Title not found on TPDB");
    }

    const item = resolved.data as Record<string, any>;
    const numericId = item._id ?? null;
    const tpdbUuid = (item.id as string | undefined) ?? params.id;

    // Both of these depend on the detail response (collection membership is
    // keyed on the numeric id, not the uuid), so they can only start now --
    // but they do not depend on each other, so they run together rather than
    // adding two serial round trips to a page that was already slow.
    const [status, library] = await Promise.all([
        // The endpoint 404s for ids TPDB does not track -- treat that as
        // "not collected" rather than failing the whole page.
        numericId
            ? providers.riven.GET("/api/v1/tpdb/collection/{numeric_id}", {
                  ...auth,
                  params: { path: { numeric_id: numericId } }
              })
            : Promise.resolve(null),
        providers.riven.GET("/api/v1/items/library_states", {
            ...auth,
            // Detail form: this page renders files, sizes and candidate
            // releases, none of which a poster grid would ask for.
            params: { query: { tpdb_ids: [tpdbUuid], detailed: true } }
        })
    ]);

    const collected = status?.data?.collected ?? false;

    // Absent from the response means "not in the library" -- the endpoint omits
    // ids it does not know rather than erroring, so a miss is not a failure.
    const libraryState = library.data?.states?.[tpdbUuid] ?? null;

    return {
        item,
        // The kind the title actually turned out to be, which is not always
        // the kind the URL asked for.
        type: resolvedType,
        numericId,
        // The uuid, not the numeric id, is what Riven stores as tpdb_id and
        // what the manual scrape addresses the title by.
        tpdbUuid,
        collected,
        libraryState,
        // Streamed, not awaited. The related row is below the fold and each
        // TPDB call is charged against a 2-per-second limit, so blocking first
        // paint on it made the page feel slow for content nobody had scrolled
        // to yet.
        streamed: {
            similar: Promise.resolve(transformTPDBList(resolvedSimilar, resolvedType)).then(
                (items) => attachLibraryStates(items, auth)
            )
        }
    };
};

export const actions: Actions = {
    /**
     * Add to the TPDB collection. TPDB exposes no DELETE on this resource, so
     * this is one-way -- the UI must not present it as a toggle.
     */
    collect: async ({ request, fetch, locals }) => {
        const form = await request.formData();
        const numericId = Number(form.get("numericId"));

        if (!numericId) return fail(400, { message: "Missing TPDB id" });

        const { error: err } = await providers.riven.POST("/api/v1/tpdb/collection/{numeric_id}", {
            baseUrl: locals.backendUrl,
            headers: { "x-api-key": locals.apiKey },
            fetch,
            params: { path: { numeric_id: numericId } }
        });

        if (err) {
            logger.error("TPDB collection add failed", err);
            return fail(502, { message: "Could not add to TPDB collection" });
        }

        return { collected: true };
    },

    /**
     * Download a specific release instead of the one Riven picked.
     *
     * The backend un-blacklists it and clears the current download, keeping the
     * candidate list intact so the choice survives.
     */
    selectRelease: async ({ request, fetch, locals }) => {
        const form = await request.formData();
        const rivenId = Number(form.get("rivenId"));
        const infohash = String(form.get("infohash") || "");

        if (!rivenId || !infohash) return fail(400, { message: "Missing release" });

        const { error: err } = await providers.riven.POST(
            "/api/v1/items/{item_id}/streams/{infohash}/select",
            {
                baseUrl: locals.backendUrl,
                headers: { "x-api-key": locals.apiKey },
                fetch,
                params: { path: { item_id: rivenId, infohash } }
            }
        );

        if (err) {
            logger.error("Release selection failed", err);
            return fail(502, { message: "Could not select that release" });
        }

        return { selected: infohash };
    },

    /** Queue the title in Riven so it gets scraped and downloaded. */
    request: async ({ request, fetch, locals }) => {
        const form = await request.formData();
        const uuid = String(form.get("uuid") || "");
        const type = String(form.get("type") || "movie");

        if (!uuid) return fail(400, { message: "Missing TPDB uuid" });

        const { error: err } = await providers.riven.POST("/api/v1/items/add", {
            baseUrl: locals.backendUrl,
            headers: { "x-api-key": locals.apiKey },
            fetch,
            body: {
                tmdb_ids: null,
                tvdb_ids: null,
                tpdb_ids: [uuid],
                media_type: type === "tv" ? "tv" : "movie"
            }
        });

        if (err) {
            logger.error("Riven request failed", err);
            return fail(502, { message: "Could not queue this title in Riven" });
        }

        return { requested: true };
    }
};
