<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import ListCarousel from "./list-carousel.svelte";

    const { Story } = defineMeta({
        title: "components/ListCarousel",
        component: ListCarousel,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen"
        }
    });

    const items = [
        {
            id: 603692,
            title: "John Wick: Chapter 4",
            poster_path: "https://image.tmdb.org/t/p/w500/vZloFAK7NmvMGKE7VkF5UHaz0I.jpg",
            year: "2023",
            media_type: "movie",
            indexer: "tmdb"
        },
        {
            id: 94605,
            title: "Arcane",
            poster_path: "https://image.tmdb.org/t/p/w500/abVBNjmZm9lDprHUEGFQ0zN3ChD.jpg",
            year: "2024",
            media_type: "tv",
            indexer: "tmdb"
        },
        {
            id: 872585,
            title: "Oppenheimer",
            poster_path: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
            year: "2023",
            media_type: "movie",
            indexer: "tmdb"
        }
    ];
</script>

<Story name="Default" asChild>
    <div class="px-8 py-4">
        <ListCarousel data={items} />
    </div>
</Story>

<Story name="Loading" asChild>
    <div class="px-8 py-4">
        <ListCarousel data={undefined} />
    </div>
</Story>
