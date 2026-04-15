import type { PageServerLoad } from "./$types";
import { gql } from "$lib/graphql-client";
import { error } from "@sveltejs/kit";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("dashboard");
const DASHBOARD_STATS_DEPENDENCY = "riven:dashboard-stats";

const STATS_QUERY = `
    query {
        stats {
            totalMovies
            totalShows
            totalSeasons
            totalEpisodes
            completed
            scraped
            indexed
            failed
            paused
            ongoing
            partiallyCompleted
            unreleased
        }
        activity
        yearReleases {
            year
            count
        }
    }
`;

export const load = (async ({ depends, fetch, locals }) => {
    depends(DASHBOARD_STATS_DEPENDENCY);

    try {
        const data = await gql<{
            stats: {
                totalMovies: number;
                totalShows: number;
                totalSeasons: number;
                totalEpisodes: number;
                completed: number;
                scraped: number;
                indexed: number;
                failed: number;
                paused: number;
                ongoing: number;
                partiallyCompleted: number;
                unreleased: number;
            };
            activity: Record<string, number>;
            yearReleases: { year: number; count: number }[];
        }>(locals.backendUrl, locals.apiKey, STATS_QUERY, {}, fetch);

        const s = data.stats;
        const total_items = s.totalMovies + s.totalShows + s.totalSeasons + s.totalEpisodes;

        return {
            statistics: {
                total_movies: s.totalMovies,
                total_shows: s.totalShows,
                total_seasons: s.totalSeasons,
                total_episodes: s.totalEpisodes,
                total_items,
                incomplete_items: total_items - s.completed,
                states: {
                    Completed: s.completed,
                    Scraped: s.scraped,
                    Indexed: s.indexed,
                    Failed: s.failed,
                    Paused: s.paused,
                    Ongoing: s.ongoing,
                    PartiallyCompleted: s.partiallyCompleted,
                    Unreleased: s.unreleased
                },
                activity: data.activity ?? {},
                media_year_releases: data.yearReleases ?? []
            },
            downloaderInfo: {
                services: []
            },
            activePlaybackSessions: []
        };
    } catch (err) {
        logger.error("Failed to fetch stats:", err);
        error(500, "Unable to fetch stats data");
    }
}) satisfies PageServerLoad;
