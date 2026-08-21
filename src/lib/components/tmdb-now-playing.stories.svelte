<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import TmdbNowPlaying from "./tmdb-now-playing.svelte";
    import { graphql, HttpResponse } from "msw";

    const gqlEndpoint = graphql.link("/graphql");

    const { Story } = defineMeta({
        title: "components/TmdbNowPlaying",
        component: TmdbNowPlaying,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen"
        }
    });

    const data = [
        {
            id: 603692,
            media_type: "movie",
            title: "John Wick: Chapter 4",
            backdrop_path: "https://image.tmdb.org/t/p/original/h9k4NHFj4CDNCzKWjEEwOAsGm2b.jpg",
            release_date: "2023-03-24",
            vote_average: 7.8,
            original_language: "en",
            overview:
                "With the price on his head ever increasing, John Wick uncovers a path to defeating The High Table.",
            genre_ids: [28, 53]
        },
        {
            id: 94605,
            media_type: "tv",
            title: "Arcane",
            backdrop_path: "https://image.tmdb.org/t/p/original/xnjA0FioBn0RJBFRxpVOZOhTOoz.jpg",
            first_air_date: "2024-11-09",
            vote_average: 9.1,
            original_language: "en",
            overview:
                "Amid the stark discord of twin cities Piltover and Zaun, two sisters fight on rival sides of a war.",
            genre_ids: [16, 10759]
        }
    ];
</script>

<Story
    name="Default"
    beforeEach={({ msw }) => {
        msw.use(
            gqlEndpoint.query("Ratings", () =>
                HttpResponse.json({
                    data: {
                        ratings: {
                            scores: [{ name: "IMDb", score: "7.8", url: "https://imdb.com" }]
                        }
                    }
                })
            ),
            gqlEndpoint.query("TmdbLogoAndCert", () =>
                HttpResponse.json({
                    data: { tmdbLogoAndCert: { logo: null, certification: "PG-13" } }
                })
            )
        );
    }}
    args={{ data }} />

<Story name="Loading" args={{ data: [] }} />
