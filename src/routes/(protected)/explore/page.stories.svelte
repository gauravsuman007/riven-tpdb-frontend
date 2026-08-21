<script module lang="ts">
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import ExplorePage from "./+page.svelte";
    import AppStoreContextDecorator from "$lib/storybook/decorators/AppStoreContextDecorator.svelte";
    import { graphql, HttpResponse } from "msw";

    const gqlEndpoint = graphql.link("/graphql");

    const { Story } = defineMeta({
        title: "pages/Explore",
        component: ExplorePage,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen"
        },
        // Reads `searchStore` context, same requirement as header/sidebar/filter-popover.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        decorators: [() => ({ Component: AppStoreContextDecorator as any })]
    });

    const mswHandlers = [
        gqlEndpoint.query("Ratings", () =>
            HttpResponse.json({
                data: {
                    ratings: { scores: [{ name: "IMDb", score: "7.8", url: "https://imdb.com" }] }
                }
            })
        )
    ];
</script>

<script lang="ts">
    import { defaults } from "sveltekit-superforms";
    import { zod4 } from "sveltekit-superforms/adapters";
    import { searchSchema } from "$lib/schemas/search";
    import type { TMDBTransformedListItem } from "$lib/metadata/parser.types";

    const form = defaults(zod4(searchSchema));

    const heroItems: TMDBTransformedListItem[] = [
        {
            id: 603692,
            title: "John Wick: Chapter 4",
            poster_path: null,
            media_type: "movie",
            year: 2023,
            vote_average: 7.8,
            vote_count: 4200,
            indexer: "tmdb",
            overview:
                "With the price on his head ever increasing, John Wick uncovers a path to defeating The High Table.",
            backdrop_path: "https://image.tmdb.org/t/p/original/h9k4NHFj4CDNCzKWjEEwOAsGm2b.jpg"
        },
        {
            id: 94605,
            title: "Arcane",
            poster_path: null,
            media_type: "tv",
            year: 2024,
            vote_average: 9.1,
            vote_count: 3100,
            indexer: "tmdb",
            overview:
                "Amid the stark discord of twin cities Piltover and Zaun, two sisters fight on rival sides of a war.",
            backdrop_path: "https://image.tmdb.org/t/p/original/xnjA0FioBn0RJBFRxpVOZOhTOoz.jpg"
        }
    ];

    const searchExamples = ["john wick", "arcane", "the matrix", "dune", "the bear", "severance"];

    const dataWithHero = {
        form,
        parsed: null,
        searchExamples,
        heroItems,
        feelingLuckyItems: heroItems
    };
    const dataEmpty = {
        form,
        parsed: null,
        searchExamples: [],
        heroItems: [],
        feelingLuckyItems: []
    };
</script>

<Story
    name="WithHero"
    beforeEach={({ msw }) => msw.use(...mswHandlers)}
    args={{ data: dataWithHero }} />

<Story
    name="NoTrendingItems"
    parameters={{
        docs: {
            description: {
                story: "No hero items available — falls back to the generic 'What would you like to watch?' prompt."
            }
        }
    }}
    args={{ data: dataEmpty }} />
