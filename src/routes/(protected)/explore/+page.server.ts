import { superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { searchSchema } from "$lib/schemas/search";
import type { PageServerLoad } from "./$types";
import { parseSearchQuery } from "$lib/search-parser";
import providers from "$lib/providers";
import { transformTPDBList, type TPDBTransformedListItem } from "$lib/providers/parser";
import { logger } from "$lib/logger";

/**
 * Discovery is sourced from the Riven backend's TPDB endpoints rather than
 * TMDB. The hero row is the backend's recommendations feed, which seeds from
 * the TPDB collection and expands each title through TPDB's own related list;
 * the browse pool is the newest movies and scenes.
 *
 * Nothing here ranks by popularity, because TPDB exposes no such signal --
 * `rating` is 0 on every record and its ordering parameters are ignored.
 */
export const load: PageServerLoad = async ({ url, fetch, locals }) => {
    const form = await superValidate(url.searchParams, zod4(searchSchema));
    const parsed = parseSearchQuery(form.data.query || "");

    let heroItems: TPDBTransformedListItem[] = [];
    let feelingLuckyItems: TPDBTransformedListItem[] = [];
    let searchExamples: string[] = [];
    let recommendationBasis: string | null = null;

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
        recommendationBasis = recommended?.basis ?? null;

        // The recommendations payload nests each movie under `movie` alongside
        // the vote count and the seeds that produced it.
        heroItems = transformTPDBList(
            (recommended?.movies ?? []).map((entry) => entry.movie)
        );

        const latest = [
            ...transformTPDBList(latestMovies.data ?? []),
            ...transformTPDBList(latestScenes.data ?? [])
        ];

        // Recommendations can be empty on a fresh account with nothing
        // collected; fall back to the newest titles so the page is never bare.
        if (heroItems.length === 0) {
            heroItems = latest.slice(0, 10);
        }

        feelingLuckyItems = shuffleArray([...heroItems, ...latest]);
        searchExamples = heroItems
            .slice(0, 6)
            .map((item) => item.title?.toLowerCase() || "")
            .filter(Boolean);
    } catch (err) {
        logger.error("Failed to fetch TPDB discovery content", err);
    }

    return {
        form,
        parsed,
        searchExamples,
        heroItems,
        feelingLuckyItems,
        recommendationBasis
    };
};

function shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}
