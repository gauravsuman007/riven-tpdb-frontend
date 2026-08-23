import type { RequestHandler } from "./$types";
import { json, error } from "@sveltejs/kit";
import providers from "$lib/providers";
import { transformTPDBList } from "$lib/providers/parser";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("tpdb-search");

/**
 * TPDB-backed replacement for the TMDB search/discover endpoint.
 *
 * Every browse surface in the app (global search, the trending list pages)
 * funnels through `SearchStore`, which calls this one route. Converting it
 * converts all of them.
 *
 * The four TMDB media types map onto TPDB collections:
 *
 *   movie   -> TPDB movies
 *   tv      -> TPDB scenes   (a scene is the closest thing to an episode)
 *   person  -> TPDB performers
 *   company -> TPDB sites    (studios / networks)
 *
 * With a query we hit TPDB's full-text search; without one we fall back to the
 * newest-first listing, which is what "discover" means here. TPDB exposes no
 * popularity or rating signal -- its ordering parameters are silently ignored
 * and `rating` is 0 on every record -- so there is no "most popular" to honour.
 */

const PER_PAGE = 40;

/** TPDB returns a bare array with no total count, so paging is inferred. */
function paged(results: unknown[], page: number, perPage: number) {
    return {
        results,
        page,
        // A full page implies at least one more; a short page is the last one.
        total_pages: results.length >= perPage ? page + 1 : page,
        total_results: results.length
    };
}

function transformPerformers(items: unknown[] | null) {
    return (items as any[])?.map((p) => ({
        id: p._id ?? 0,
        tpdb_uuid: p.id ?? null,
        title: p.name || "",
        poster_path: p.image || p.face || p.posters?.large || null,
        media_type: "person",
        indexer: "tpdb" as const,
        overview: p.bio || "",
        year: "N/A"
    })) ?? [];
}

function transformSites(items: unknown[] | null) {
    return (items as any[])?.map((s) => ({
        id: s.id ?? 0,
        tpdb_uuid: s.uuid ?? null,
        title: s.name || "",
        poster_path: s.logo || s.poster || s.image || null,
        media_type: "company",
        indexer: "tpdb" as const,
        overview: s.description || "",
        year: "N/A"
    })) ?? [];
}

export const GET: RequestHandler = async ({ fetch, params, locals, url }) => {
    if (!locals.user || !locals.session) {
        error(401, "Unauthorized");
    }

    const { type } = params;
    if (type !== "movie" && type !== "tv" && type !== "person" && type !== "company") {
        error(400, "Invalid media type. Must be 'movie', 'tv', 'person', or 'company'");
    }

    const page = Number(url.searchParams.get("page") || "1") || 1;
    const query = (url.searchParams.get("query") || "").trim();

    const auth = {
        baseUrl: locals.backendUrl,
        headers: { "x-api-key": locals.apiKey },
        fetch
    };

    try {
        // Performers and sites have no newest-first feed on TPDB; they are
        // search-only, so an empty query yields nothing rather than an error.
        if (type === "person" || type === "company") {
            if (!query) return json(paged([], page, PER_PAGE));

            const { data, error: err } = await providers.riven.GET("/api/v1/tpdb/search", {
                ...auth,
                params: { query: { query, type: type === "person" ? "performers" : "sites" } }
            });
            if (err) throw new Error(JSON.stringify(err));

            const results =
                type === "person"
                    ? transformPerformers(data ?? [])
                    : transformSites(data ?? []);
            return json(paged(results, page, PER_PAGE));
        }

        const mediaType = type === "movie" ? "movie" : "tv";

        if (query) {
            const { data, error: err } = await providers.riven.GET("/api/v1/tpdb/search", {
                ...auth,
                params: {
                    query: {
                        query,
                        type: type === "movie" ? "movies" : "scenes",
                        page,
                        per_page: PER_PAGE
                    }
                }
            });
            if (err) throw new Error(JSON.stringify(err));

            return json(paged(transformTPDBList(data ?? [], mediaType), page, PER_PAGE));
        }

        const path = type === "movie" ? "/api/v1/tpdb/movies" : "/api/v1/tpdb/scenes";
        const { data, error: err } = await providers.riven.GET(path, {
            ...auth,
            params: { query: { page, per_page: PER_PAGE } }
        });
        if (err) throw new Error(JSON.stringify(err));

        return json(paged(transformTPDBList(data ?? [], mediaType), page, PER_PAGE));
    } catch (e) {
        logger.error(`TPDB ${type} search failed`, e);
        error(502, "TPDB request failed");
    }
};
