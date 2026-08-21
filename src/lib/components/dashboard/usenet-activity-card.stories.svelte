<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import UsenetActivityCard from "./usenet-activity-card.svelte";

    const { Story } = defineMeta({
        title: "dashboard/UsenetActivityCard",
        component: UsenetActivityCard,
        tags: ["autodocs"]
    });
</script>

<script lang="ts">
    import type { UsenetStreamingHealth, UsenetTraffic } from "./types";

    const health: UsenetStreamingHealth = {
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

    const traffic: UsenetTraffic = {
        providers: [
            {
                host: "news.provider-a.com",
                bytesDownloaded: 274877906944,
                articlesDownloaded: 89234
            },
            {
                host: "news.provider-b.com",
                bytesDownloaded: 137438953472,
                articlesDownloaded: 41203
            }
        ],
        daily: [
            {
                day: "2024-06-08",
                host: "news.provider-a.com",
                bytesDownloaded: 42949672960,
                articlesDownloaded: 12043
            },
            {
                day: "2024-06-09",
                host: "news.provider-a.com",
                bytesDownloaded: 38654705664,
                articlesDownloaded: 10982
            }
        ],
        totalBytesDownloaded: 412316860416,
        totalArticlesDownloaded: 130437
    };
</script>

<Story name="Default" args={{ health, traffic }} />

<Story name="NoData" args={{ health: null, traffic: null }} />
