<script module lang="ts">
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import TrendingMoviePage from "./+page.svelte";
    import AppStoreContextDecorator from "$lib/storybook/decorators/AppStoreContextDecorator.svelte";
    import { graphql, HttpResponse } from "msw";

    const gqlEndpoint = graphql.link("/graphql");

    const { Story } = defineMeta({
        title: "pages/TrendingMovies",
        component: TrendingMoviePage,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen",
            docs: {
                description: {
                    component:
                        "Reads `searchStore`/`filterStore` from context (set by the root layout) rather than creating its own, unlike the TV variant — see `AppStoreContextDecorator`."
                }
            }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        decorators: [() => ({ Component: AppStoreContextDecorator as any })]
    });
</script>

<Story
    name="Default"
    beforeEach={({ msw }) => {
        msw.use(
            gqlEndpoint.query("SearchTmdb", () =>
                HttpResponse.json({
                    data: {
                        searchTmdb: {
                            results: [
                                {
                                    id: 603692,
                                    title: "John Wick: Chapter 4",
                                    posterPath: null,
                                    mediaType: "movie",
                                    year: "2023",
                                    voteAverage: 7.8,
                                    voteCount: 4200,
                                    indexer: "tmdb"
                                }
                            ],
                            page: 1,
                            totalPages: 1,
                            totalResults: 1
                        }
                    }
                })
            )
        );
    }} />
