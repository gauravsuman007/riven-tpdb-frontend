import { error, fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import providers from "$lib/providers";
import { transformTPDBList } from "$lib/providers/parser";
import { logger } from "$lib/logger";

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

    if (detail.error || !detail.data) {
        logger.error("TPDB detail fetch failed", detail.error);
        error(404, "Title not found on TPDB");
    }

    const item = detail.data as Record<string, any>;
    const numericId = item._id ?? null;

    // Collection membership is keyed on the numeric id, not the UUID, and the
    // endpoint 404s for ids TPDB does not track -- treat that as "not collected"
    // rather than failing the whole page.
    let collected = false;
    if (numericId) {
        const status = await providers.riven.GET("/api/v1/tpdb/collection/{numeric_id}", {
            ...auth,
            params: { path: { numeric_id: numericId } }
        });
        collected = status.data?.collected ?? false;
    }

    return {
        item,
        type,
        numericId,
        collected,
        similar: transformTPDBList(similar.data ?? [], type)
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
