<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import TrendingAnimePage from "./+page.svelte";
    import { graphql, HttpResponse } from "msw";

    const gqlEndpoint = graphql.link("/graphql");

    const { Story } = defineMeta({
        title: "pages/TrendingAnime",
        component: TrendingAnimePage,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen",
            docs: {
                description: {
                    component:
                        "Unlike the movie/TV trending pages, this one wasn't folded into `TrendingDiscoveryPage` — it drives its own `MediaListStore` against the AniList-backed `trendingAnilist` query, which fires as soon as the store is constructed."
                }
            }
        }
    });
</script>

<Story
    name="Default"
    beforeEach={({ msw }) => {
        msw.use(
            gqlEndpoint.query("TrendingAnilist", () =>
                HttpResponse.json({
                    data: {
                        trendingAnilist: {
                            results: [
                                {
                                    id: 21,
                                    title: "One Piece",
                                    posterPath: null,
                                    mediaType: "tv",
                                    year: "1999"
                                },
                                {
                                    id: 16498,
                                    title: "Attack on Titan",
                                    posterPath: null,
                                    mediaType: "tv",
                                    year: "2013"
                                }
                            ]
                        }
                    }
                })
            )
        );
    }} />
