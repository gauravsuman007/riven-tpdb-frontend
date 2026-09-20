import { superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { searchSchema } from "$lib/schemas/search";
import type { PageServerLoad } from "./$types";
import { parseSearchQuery } from "$lib/search-parser";
import providers from "$lib/providers";
import { transformTPDBList, type TPDBTransformedListItem } from "$lib/providers/parser";
import { logger } from "$lib/logger";
import { findEntities, NO_ENTITIES } from "$lib/entity-search";

/**
 * Discovery is sourced from the Riven backend's TPDB endpoints rather than
 * TMDB. The hero row is the backend's recommendations feed, which seeds from
 * the TPDB collection and expands each title through TPDB's own related list;
 * the browse pool is the newest movies and scenes.
 *
 * Nothing here ranks by popularity, because TPDB exposes no such signal --
 * `rating` is 0 on every record and its ordering parameters are ignored.
 */
export interface Discovery {
    heroItems: TPDBTransformedListItem[];
    feelingLuckyItems: TPDBTransformedListItem[];
    searchExamples: string[];
    recommendationBasis: string | null;
}

const NOTHING: Discovery = {
    heroItems: [],
    feelingLuckyItems: [],
    searchExamples: [],
    recommendationBasis: null
};

export const load: PageServerLoad = async ({ url, fetch, locals }) => {
    const form = await superValidate(url.searchParams, zod4(searchSchema));
    const parsed = parseSearchQuery(form.data.query || "");

    // Discovery content feeds the empty state only -- the hero carousel, the
    // "Feeling Lucky" pool and the example chips all render inside
    // `{#if showEmptyState}`. A search re-runs this load (the header debounces
    // into `goto`), and refetching ~3MB of query-irrelevant JSON is what made
    // typing feel slow. When there is a query, skip it: the search results
    // replace this content anyway, and clearing the box navigates back to the
    // query-less URL, which repopulates it.
    // Named apart from the `auth` inside the discovery closure below: that
    // one carries prebuilt headers for the generated provider client, this
    // one a bare key for the hand-maintained studio/add-on clients.
    const entityAuth = {
        baseUrl: locals.backendUrl,
        apiKey: locals.apiKey,
        fetch
    };

    if (parsed?.query) {
        /*
            Studios and OnlyFans accounts, as their own rows.

            Streamed rather than awaited, like discovery below. Both are local
            database reads and answer in milliseconds, but the title results
            are fetched by the client store and should not wait behind a
            server round-trip to appear -- a search that renders its titles
            promptly and fills two rows in afterwards reads as fast, and the
            reverse does not.
        */
        return { form, parsed, discovery: NOTHING, entities: findEntities(parsed.query, entityAuth) };
    }

    /*
        Streamed, not awaited.

        Recommendations, latest movies and latest scenes come to about 3.2MB of
        JSON between them, and TPDB is slow whenever its cache is cold --
        measured at 10-16s for a single call on this backend. The page used to
        render nothing until all three had arrived, including the search box,
        which is the one thing someone landing here wants immediately.
    */
    const discovery = (async (): Promise<Discovery> => {
        try {
            const auth = {
                baseUrl: locals.backendUrl,
                headers: { "x-api-key": locals.apiKey },
                fetch
            };

            const [recommendations, latestMovies, latestScenes] = await Promise.all([
                providers.riven.GET("/api/v1/tpdb/recommendations", {
                    ...auth,
                    params: { query: { limit: 20 } }
                }),
                providers.riven.GET("/api/v1/tpdb/movies", {
                    ...auth,
                    params: { query: { per_page: 40 } }
                }),
                providers.riven.GET("/api/v1/tpdb/scenes", {
                    ...auth,
                    params: { query: { per_page: 40 } }
                })
            ]);

            if (recommendations.error) {
                logger.error("TPDB recommendations failed", recommendations.error);
            }

            const recommended = recommendations.data;

            // The recommendations payload nests each movie under `movie`
            // alongside the vote count and the seeds that produced it.
            let heroItems = transformTPDBList(
                (recommended?.movies ?? []).map((entry) => entry.movie)
            );

            const latest = [
                ...transformTPDBList(latestMovies.data ?? []),
                ...transformTPDBList(latestScenes.data ?? [])
            ];

            // Recommendations can be empty on a fresh account with nothing
            // collected; fall back to the newest titles so the page is never
            // bare.
            if (heroItems.length === 0) {
                heroItems = latest.slice(0, 10);
            }

            return {
                heroItems,
                feelingLuckyItems: shuffleArray([...heroItems, ...latest]),
                searchExamples: heroItems
                    .slice(0, 6)
                    .map((item) => item.title?.toLowerCase() || "")
                    .filter(Boolean),
                recommendationBasis: recommended?.basis ?? null
            };
        } catch (err) {
            // Resolved with nothing rather than rejected: a rejected streamed
            // promise surfaces as an unhandled client error, and an empty
            // discovery rail is the better failure.
            logger.error("Failed to fetch TPDB discovery content", err);

            return NOTHING;
        }
    })();

    return { form, parsed, discovery, entities: Promise.resolve(NO_ENTITIES) };
};

function shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}
