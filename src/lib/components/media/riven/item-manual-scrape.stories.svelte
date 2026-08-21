<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import ItemManualScrape from "./item-manual-scrape.svelte";

    const { Story } = defineMeta({
        title: "media/riven/ItemManualScrape",
        component: ItemManualScrape,
        tags: ["autodocs"],
        args: {
            title: "John Wick: Chapter 4",
            itemId: "123",
            externalId: "603692",
            mediaType: "movie"
        }
    });
</script>

<Story name="Movie" />

<Story
    name="TvShow"
    args={{
        mediaType: "tv",
        seasons: [
            { id: 1, season_number: 1, episode_count: 9, name: "Season 1" },
            { id: 2, season_number: 2, episode_count: 9, name: "Season 2" }
        ]
    }} />
