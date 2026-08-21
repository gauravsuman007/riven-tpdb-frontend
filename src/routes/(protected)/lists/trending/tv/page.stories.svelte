<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import TrendingTvPage from "./+page.svelte";
    import { graphql, HttpResponse } from "msw";

    const gqlEndpoint = graphql.link("/graphql");

    const { Story } = defineMeta({
        title: "pages/TrendingTv",
        component: TrendingTvPage,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen",
            docs: {
                description: {
                    component:
                        "Creates its own local `searchStore`/`filterStore` instances (via `setContext`), unlike the movie variant — no context decorator needed."
                }
            }
        }
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
                                    id: 94605,
                                    title: "Arcane",
                                    posterPath: null,
                                    mediaType: "tv",
                                    year: "2024",
                                    voteAverage: 9.1,
                                    voteCount: 3100,
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
