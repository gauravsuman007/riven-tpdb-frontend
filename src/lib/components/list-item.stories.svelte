<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import ListItem from "./list-item.svelte";

    const { Story } = defineMeta({
        title: "components/ListItem",
        component: ListItem,
        tags: ["autodocs"]
    });
</script>

<Story name="Movie" asChild>
    <div class="w-48">
        <ListItem
            data={{
                id: 603692,
                title: "John Wick: Chapter 4",
                poster_path: "https://image.tmdb.org/t/p/w500/vZloFAK7NmvMGKE7VkF5UHaz0I.jpg",
                year: "2023",
                media_type: "movie"
            }}
            indexer="tmdb"
            type="movie" />
    </div>
</Story>

<Story name="TvWithBadge" asChild>
    <div class="w-48">
        <ListItem
            data={{
                id: 94605,
                title: "Arcane",
                poster_path: "https://image.tmdb.org/t/p/w500/abVBNjmZm9lDprHUEGFQ0zN3ChD.jpg",
                year: "2024",
                media_type: "tv",
                badge: { text: "Completed", variant: "success" }
            }}
            indexer="tmdb"
            type="tv" />
    </div>
</Story>

<Story name="Person" asChild>
    <div class="w-48">
        <ListItem
            data={{
                id: 6384,
                title: "Keanu Reeves",
                poster_path: null
            }}
            type="person" />
    </div>
</Story>
