import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import providers from "$lib/providers";
import { transformTMDBList, type TMDBListItem } from "$lib/providers/parser";
import { createCustomFetch } from "$lib/custom-fetch";
import { createScopedLogger } from "$lib/logger";
import { gql } from "$lib/graphql-client";
import {
    getRecentItemsVariables,
    mapRecentItemsPage,
    RECENT_ITEMS_QUERY,
    type RecentListItem,
    type RecentItemsResponse
} from "$lib/services/recent-items";

const logger = createScopedLogger("home");

export const load: PageServerLoad = async ({ locals, fetch }) => {
    if (!locals.user || !locals.session) redirect(302, "/auth/login");

    try {
        const { data } = await providers.tmdb.GET("/3/trending/all/{time_window}", {
            fetch: createCustomFetch(fetch),
            params: {
                path: { time_window: "day" },
                query: { language: "en-US" }
            }
        });

        let recentlyAdded: RecentListItem[] = [];
        try {
            const recentData = await gql<RecentItemsResponse>(
                locals.backendUrl,
                locals.apiKey,
                RECENT_ITEMS_QUERY,
                getRecentItemsVariables(),
                fetch
            );
            recentlyAdded = mapRecentItemsPage(recentData).items;
        } catch (err) {
            logger.error("Error fetching recently added data:", err);
        }

        // Filter to only movies and TV shows with backdrops
        const tmdbResults = (data?.results ?? []) as TMDBListItem[];
        const filtered = tmdbResults.filter(
            (item) =>
                (item.media_type === "movie" || item.media_type === "tv") && item.backdrop_path
        );

        return {
            nowPlaying: transformTMDBList(filtered, "movie", "original"),
            recentlyAdded
        };
    } catch (err) {
        logger.error("Error fetching now playing data:", err);
        return { nowPlaying: [], recentlyAdded: [] };
    }
};
