<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import RatingsRow from "./ratings-row.svelte";

    const { Story } = defineMeta({
        title: "media/RatingsRow",
        component: RatingsRow,
        tags: ["autodocs"]
    });
</script>

<Story
    name="Default"
    args={{
        loading: false,
        scores: [
            { name: "TMDB", score: "7.8", url: "https://www.themoviedb.org", image: "tmdb.svg" },
            { name: "IMDb", score: "8.1", url: "https://www.imdb.com", image: "imdb.svg" }
        ]
    }} />

<Story name="Loading" args={{ loading: true, scores: null }} />

<Story name="Empty" args={{ loading: false, scores: [] }} />
