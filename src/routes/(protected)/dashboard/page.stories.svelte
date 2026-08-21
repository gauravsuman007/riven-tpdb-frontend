<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import DashboardPage from "./+page.svelte";
    import { graphql, HttpResponse } from "msw";

    const gqlEndpoint = graphql.link("/graphql");

    const { Story } = defineMeta({
        title: "pages/Dashboard",
        component: DashboardPage,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen",
            docs: {
                description: {
                    component:
                        "A static snapshot only: the page polls `ActivePlaybackSessions`/usenet health every 15s and refreshes on a live-update subscription — none of that polling is exercised, just one fixed render seeded from `data` plus a mocked `DashboardStats` query."
                }
            }
        }
    });
</script>

<script lang="ts">
    import type {
        ActivePlaybackSession,
        DownloaderService,
        NntpProviderHealth,
        UsenetStreamingHealth,
        UsenetTitleHealth,
        UsenetTitleHealthSummary,
        UsenetTraffic
    } from "$lib/components/dashboard/types";
    import { getPermissionFlags } from "$lib/permissions";

    const statistics = {
        total_movies: 842,
        total_shows: 156,
        total_seasons: 612,
        total_episodes: 11029,
        total_items: 998,
        incomplete_items: 47,
        completion_rate: 95.29,
        states: {
            Completed: 951,
            Scraped: 8,
            Indexed: 0,
            Failed: 15,
            Paused: 0,
            Ongoing: 12,
            PartiallyCompleted: 0,
            Unreleased: 0
        },
        activity: {},
        media_year_releases: [
            { year: 2022, count: 121 },
            { year: 2023, count: 154 },
            { year: 2024, count: 178 }
        ]
    };

    const activePlaybackSessions: ActivePlaybackSession[] = [
        {
            server: "Plex",
            userName: "alice",
            parentTitle: "Arcane",
            itemTitle: "The Base Violence Necessary for Change",
            itemType: "episode",
            seasonNumber: 2,
            episodeNumber: 5,
            playbackState: "playing",
            playbackMethod: "Direct Play",
            positionSeconds: 842,
            durationSeconds: 1620,
            deviceName: "Living Room TV",
            clientName: "Plex for Android TV",
            imageUrl: null
        }
    ];

    const downloaderServices: DownloaderService[] = [
        {
            service: "Real-Debrid",
            email: "user@example.com",
            username: "rdUser",
            premium_status: "premium",
            premium_expires_at: "2025-12-31T00:00:00Z",
            premium_days_left: 120,
            points: 4500,
            total_downloaded_bytes: 1073741824000,
            cooldown_until: null
        }
    ];

    const usenetProviders: NntpProviderHealth[] = [
        {
            host: "news.provider-a.com",
            port: 563,
            priority: 0,
            isBackup: false,
            maxConnections: 50,
            openConnections: 32,
            idleConnections: 8,
            activeConnections: 24,
            demoted: false,
            consecutiveNotFound: 0
        }
    ];

    const usenetStreaming: UsenetStreamingHealth = {
        caches: [
            {
                name: "segment-cache",
                bytesUsed: 4294967296,
                bytesMax: 8589934592,
                entries: 18234,
                hits: 92381,
                misses: 4021,
                hitRate: 0.958
            }
        ],
        cacheHitRate: 0.958,
        fetchesOk: 128492,
        fetchesFailed: 342,
        fetchSuccessRate: 0.9973,
        bytesDecoded: 549755813888,
        inFlight: 12,
        deadSegments: 8,
        activeStreams: 4
    };

    const usenetTitles: UsenetTitleHealth[] = [
        {
            infoHash: "abc123",
            fileIndex: 0,
            mediaItemId: 42,
            status: "healthy",
            totalSegments: 500,
            sampledSegments: 50,
            missingSegments: 0,
            errorSegments: 0,
            missingPct: 0,
            checkedAt: 1718000000,
            repairAttempts: 0,
            nextRepairAt: null,
            title: "John Wick: Chapter 4",
            subtitle: null,
            posterPath: null,
            mediaType: "movie"
        }
    ];

    const usenetTitleSummary: UsenetTitleHealthSummary = {
        healthy: 340,
        unhealthy: 12,
        notIngested: 3,
        unknown: 1,
        total: 356
    };

    const usenetTraffic: UsenetTraffic = {
        providers: [
            {
                host: "news.provider-a.com",
                bytesDownloaded: 274877906944,
                articlesDownloaded: 89234
            }
        ],
        daily: [
            {
                day: "2024-06-08",
                host: "news.provider-a.com",
                bytesDownloaded: 42949672960,
                articlesDownloaded: 12043
            }
        ],
        totalBytesDownloaded: 412316860416,
        totalArticlesDownloaded: 130437
    };

    const data = {
        user: { id: "1", name: "Alice", email: "alice@example.com" },
        permissions: getPermissionFlags("user"),
        statistics: Promise.resolve(statistics),
        activePlaybackSessions: Promise.resolve(activePlaybackSessions),
        downloaderServices: Promise.resolve(downloaderServices),
        usenetHealth: Promise.resolve({
            providers: usenetProviders,
            streaming: usenetStreaming,
            titles: usenetTitles,
            titleSummary: usenetTitleSummary,
            traffic: usenetTraffic
        })
    };
</script>

<Story
    name="Default"
    beforeEach={({ msw }) => {
        msw.use(
            gqlEndpoint.query("DashboardStats", () =>
                HttpResponse.json({
                    data: {
                        stats: {
                            totalMovies: statistics.total_movies,
                            totalShows: statistics.total_shows,
                            totalSeasons: statistics.total_seasons,
                            totalEpisodes: statistics.total_episodes,
                            totalItems: statistics.total_items,
                            incompleteItems: statistics.incomplete_items,
                            completionRate: statistics.completion_rate,
                            completed: 951,
                            scraped: 8,
                            indexed: 0,
                            failed: 15,
                            paused: 0,
                            ongoing: 0,
                            partiallyCompleted: 0,
                            unreleased: 0
                        },
                        activity: {},
                        yearReleases: statistics.media_year_releases
                    }
                })
            )
        );
    }}
    args={{ data }} />
