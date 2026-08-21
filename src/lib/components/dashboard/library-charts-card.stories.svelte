<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import LibraryChartsCard from "./library-charts-card.svelte";

    const { Story } = defineMeta({
        title: "dashboard/LibraryChartsCard",
        component: LibraryChartsCard,
        tags: ["autodocs"]
    });
</script>

<script lang="ts">
    import type { DashboardStatistics } from "./types";

    const statistics: DashboardStatistics = {
        total_movies: 842,
        total_shows: 156,
        total_seasons: 612,
        total_episodes: 11029,
        total_items: 998,
        incomplete_items: 47,
        completion_rate: 95.29,
        states: {
            Completed: 951,
            Downloading: 12,
            Scraping: 8,
            Failed: 15,
            Requested: 12
        },
        activity: {},
        media_year_releases: [
            { year: 2020, count: 62 },
            { year: 2021, count: 88 },
            { year: 2022, count: 121 },
            { year: 2023, count: 154 },
            { year: 2024, count: 178 }
        ]
    };
</script>

<Story name="Default" args={{ statistics }} />

<Story name="Loading" args={{ statistics: undefined }} />
