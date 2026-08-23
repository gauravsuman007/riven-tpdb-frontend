import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import providers from "$lib/providers";
import { transformTPDBList } from "$lib/providers/parser";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("home");

/**
 * The hero carousel is sourced from the backend's TPDB endpoints rather than
 * TMDB trending, so an adult-only deployment does not surface mainstream
 * titles. Recommendations lead when the TPDB collection has anything in it;
 * otherwise the newest movies stand in.
 *
 * `recentlyAdded` already came from the Riven library and is unchanged.
 */
export const load: PageServerLoad = async ({ locals, fetch }) => {
    if (!locals.user || !locals.session) redirect(302, "/auth/login");

    try {
        const auth = {
            baseUrl: locals.backendUrl,
            headers: { "x-api-key": locals.apiKey },
            fetch
        };

        const [recommendations, latestMovies] = await Promise.all([
            providers.riven.GET("/api/v1/tpdb/recommendations", {
                ...auth,
                params: { query: { limit: 20 } }
            }),
            providers.riven.GET("/api/v1/tpdb/movies", {
                ...auth,
                params: { query: { per_page: 40 } }
            })
        ]);

        if (recommendations.error) {
            logger.error("TPDB recommendations failed", recommendations.error);
        }

        const recommended = transformTPDBList(
            (recommendations.data?.movies ?? []).map((entry) => entry.movie)
        );
        const latest = transformTPDBList(latestMovies.data ?? []);

        // The carousel is a backdrop-led layout, so anything without one is
        // dropped rather than rendered as an empty panel.
        const withBackdrop = [...recommended, ...latest].filter((item) => item.backdrop_path);

        const recentlyAddedRes = await fetch("/api/library/recent");
        const recentlyAddedJson = recentlyAddedRes.ok
            ? await recentlyAddedRes.json()
            : { items: [] };

        return {
            nowPlaying: withBackdrop.slice(0, 20),
            recentlyAdded: (recentlyAddedJson.items || []) as any[]
        };
    } catch (err) {
        logger.error("Error fetching TPDB home content:", err);
        return { nowPlaying: [], recentlyAdded: [] };
    }
};
