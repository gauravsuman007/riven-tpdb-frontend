<script module lang="ts">
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import HomePage from "./+page.svelte";
    import { graphql, HttpResponse } from "msw";

    const gqlEndpoint = graphql.link("/graphql");

    const { Story } = defineMeta({
        title: "pages/Home",
        component: HomePage,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen",
            docs: {
                description: {
                    component:
                        "A static snapshot only: `TrendingMovies`/`TrendingShows`/`TrendingAnime` each fetch on mount via their own `MediaListStore`, and a background live-update subscription refreshes 'Recently Added' — none of that polling/live behavior is exercised here, just one fixed render."
                }
            }
        }
    });

    function trendingResult(id: number, title: string, mediaType: string) {
        return { id, title, posterPath: null, mediaType, year: 2024, popularity: 100 };
    }
</script>

<script lang="ts">
    import type { RecentListItem } from "$lib/services/recent-items";
    import type { TMDBTransformedListItem } from "$lib/metadata/parser.types";
    import { getPermissionFlags } from "$lib/permissions";

    const nowPlaying: TMDBTransformedListItem[] = [
        {
            id: 603692,
            media_type: "movie",
            title: "John Wick: Chapter 4",
            poster_path: null,
            year: 2023,
            vote_average: 7.8,
            vote_count: 4200,
            indexer: "tmdb",
            backdrop_path: "https://image.tmdb.org/t/p/original/h9k4NHFj4CDNCzKWjEEwOAsGm2b.jpg",
            release_date: "2023-03-24"
        }
    ];

    const recentlyAdded: RecentListItem[] = [
        {
            id: 603692,
            indexer: "tmdb",
            title: "John Wick: Chapter 4",
            poster_path: null,
            media_type: "movie",
            year: 2023,
            riven_id: 1
        },
        {
            id: 94605,
            indexer: "tmdb",
            title: "Arcane",
            poster_path: null,
            media_type: "tv",
            year: 2024,
            riven_id: 2
        }
    ];

    const user = { id: "1", name: "Alice", email: "alice@example.com" };
    const permissions = getPermissionFlags("user");

    const data = { user, permissions, nowPlaying, recentlyAdded };
</script>

<Story
    name="Default"
    beforeEach={({ msw }) => {
        msw.use(
            gqlEndpoint.query("TrendingTmdb", ({ variables }) =>
                HttpResponse.json({
                    data: {
                        trendingTmdb: {
                            results:
                                variables.type === "movie"
                                    ? [trendingResult(603692, "John Wick: Chapter 4", "movie")]
                                    : [trendingResult(94605, "Arcane", "tv")]
                        }
                    }
                })
            ),
            gqlEndpoint.query("TrendingAnilist", () =>
                HttpResponse.json({
                    data: { trendingAnilist: { results: [trendingResult(21, "One Piece", "tv")] } }
                })
            ),
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
