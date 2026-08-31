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
    //
    // `similar` is started here but deliberately NOT awaited. TPDB answers its
    // /similar endpoint in 10-16 seconds -- measured, repeatedly -- and this
    // page used to sit inside a Promise.all with it, so every cold detail load
    // paid that in full before rendering anything. The promise is handed to
    // `streamed` below and resolves after the page has painted.
    const relatedFor = (kind: "movie" | "tv", uuid: string) =>
        kind === "movie"
            ? providers.riven.GET("/api/v1/tpdb/movies/{movie_id}/similar", {
                  ...auth,
                  params: { path: { movie_id: uuid } }
              })
            : providers.riven.GET("/api/v1/tpdb/scenes/{scene_id}/similar", {
                  ...auth,
                  params: { path: { scene_id: uuid } }
              });

    const detail = await (type === "movie"
        ? providers.riven.GET("/api/v1/tpdb/movies/{movie_id}", {
              ...auth,
              params: { path: { movie_id: id } }
          })
        : providers.riven.GET("/api/v1/tpdb/scenes/{scene_id}", {
              ...auth,
              params: { path: { scene_id: id } }
          }));

    // A TPDB uuid names either a scene or a movie, and Riven stores both as
    // type "movie" -- so a scene reached from the library arrives here asking
    // for a movie and misses. Fall back to the other kind rather than 404-ing
    // a title that plainly exists.
    let resolved = detail.data ? detail : null;
    let resolvedType: "movie" | "tv" = type;

    if (!resolved) {
        const otherType: "movie" | "tv" = type === "movie" ? "tv" : "movie";
        const fallback = await (otherType === "movie"
            ? providers.riven.GET("/api/v1/tpdb/movies/{movie_id}", {
                  ...auth,
                  params: { path: { movie_id: id } }
              })
            : providers.riven.GET("/api/v1/tpdb/scenes/{scene_id}", {
                  ...auth,
                  params: { path: { scene_id: id } }
              }));

        if (fallback.data) {
            resolved = fallback;
            resolvedType = otherType;
        }
    }

    if (!resolved?.data) {
        logger.error("TPDB detail fetch failed", detail.error);
        error(404, "Title not found on TPDB");
    }

    const item = resolved.data as Record<string, any>;
    const numericId = item._id ?? null;
    const tpdbUuid = (item.id as string | undefined) ?? params.id;

    /*
        Both depend on the detail response (collection membership is keyed on
        the numeric id, not the uuid) so they can only start now -- and neither
        depends on the other, so they run together.

        Streamed rather than awaited: they drive a badge and a state pill, not
        the title, poster or synopsis. Blocking first paint on them added a
        round trip to a page whose whole point is the content already fetched.
    */
    const collected = (
        numericId
            ? providers.riven
                  // The endpoint 404s for ids TPDB does not track -- treat that
                  // as "not collected" rather than failing the page.
                  .GET("/api/v1/tpdb/collection/{numeric_id}", {
                      ...auth,
                      params: { path: { numeric_id: numericId } }
                  })
                  .then((status) => status?.data?.collected ?? false)
                  .catch(() => false)
            : Promise.resolve(false)
    ) as Promise<boolean>;

    const libraryState = providers.riven
        .GET("/api/v1/items/library_states", {
            ...auth,
            // Detail form: this page renders files, sizes and candidate
            // releases, none of which a poster grid would ask for.
            params: { query: { tpdb_ids: [tpdbUuid], detailed: true } }
        })
        // Absent from the response means "not in the library" -- the endpoint
        // omits ids it does not know rather than erroring, so a miss is not a
        // failure.
        .then((library) => library.data?.states?.[tpdbUuid] ?? null)
        .catch((err) => {
            logger.error("Library state fetch failed", err);
            return null;
        });

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
            // Only started now that the title's real kind is known, and never
            // awaited here -- see the note above `relatedFor`. A failure is
            // rendered as an empty row rather than taken as a page error.
            similar: relatedFor(resolvedType, tpdbUuid)
                .then((related) => transformTPDBList(related.data ?? [], resolvedType))
                .then((items) => attachLibraryStates(items, auth))
                .catch((err) => {
                    logger.error("TPDB related fetch failed", err);
                    return [];
                })
        }
    };
};

export const actions: Actions = {
    // No standalone "add to TPDB collection" action anymore -- there is only
    // one "Add to collection" button now (AddToCollection.svelte), and its
    // backend endpoint syncs to TPDB itself (content.collections.sync_to_tpdb,
    // on by default). `collected`, loaded above, is read-only status feedback
    // for that automatic sync, not a separate action to trigger it.

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
