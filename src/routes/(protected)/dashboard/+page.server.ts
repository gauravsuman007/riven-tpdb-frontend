import type { PageServerLoad } from "./$types";
import { gql } from "$lib/graphql-client";
import { error } from "@sveltejs/kit";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("dashboard");

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
        debridAccountInfo {
            store
            email
            username
            subscriptionStatus
            premiumUntil
            cooldownUntil
            totalDownloadedBytes
            points
        }
        activePlaybackSessions {
            server
            userName
            parentTitle
            itemTitle
            itemType
            seasonNumber
            episodeNumber
            playbackState
            playbackMethod
            positionSeconds
            durationSeconds
            deviceName
            clientName
            imageUrl
        }
    }
`;

export const load = (async ({ fetch, locals }) => {
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
            debridAccountInfo: { store: string; email: string | null; username: string | null; subscriptionStatus: string | null; premiumUntil: string | null; cooldownUntil: string | null; totalDownloadedBytes: number | null; points: number | null }[];
            activePlaybackSessions: {
                server: string;
                userName: string | null;
                parentTitle: string | null;
                itemTitle: string;
                itemType: string | null;
                seasonNumber: number | null;
                episodeNumber: number | null;
                playbackState: string;
                playbackMethod: string;
                positionSeconds: number | null;
                durationSeconds: number | null;
                deviceName: string | null;
                clientName: string | null;
                imageUrl: string | null;
            }[];
        }>(locals.backendUrl, locals.apiKey, STATS_QUERY, {}, fetch);

        const s = data.stats;
        const total_items =
            s.totalMovies + s.totalShows + s.totalSeasons + s.totalEpisodes;

        const debridServices = (data.debridAccountInfo ?? []).map((info) => {
            const now = Date.now();
            const expiresMs = info.premiumUntil ? new Date(info.premiumUntil).getTime() : null;
            const daysLeft =
                expiresMs !== null && !isNaN(expiresMs)
                    ? Math.ceil((expiresMs - now) / (1000 * 60 * 60 * 24))
                    : null;
            return {
                service: info.store,
                email: info.email ?? null,
                username: info.username ?? null,
                premium_status: info.subscriptionStatus ?? "expired",
                premium_expires_at: info.premiumUntil ?? null,
                premium_days_left: daysLeft,
                points: info.points ?? null,
                total_downloaded_bytes: info.totalDownloadedBytes ?? null,
                cooldown_until: info.cooldownUntil ?? null
            };
        });

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
                services: debridServices
            },
            activePlaybackSessions: data.activePlaybackSessions ?? []
        };
    } catch (err) {
        logger.error("Failed to fetch stats:", err);
        error(500, "Unable to fetch stats data");
    }
}) satisfies PageServerLoad;
