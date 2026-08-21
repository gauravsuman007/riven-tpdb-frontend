<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import EntityPage from "./+page.svelte";

    const { Story } = defineMeta({
        title: "pages/EntityDetails",
        component: EntityPage,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen"
        }
    });
</script>

<script lang="ts">
    import type { PersonDetails } from "$lib/metadata/parser.types";
    import { getPermissionFlags } from "$lib/permissions";

    const user = { id: "1", name: "Alice", email: "alice@example.com" };
    const permissions = getPermissionFlags("user");

    const baseCredits = {
        poster_path: null,
        backdrop_path: null,
        release_date: "2023-03-24",
        year: 2023,
        vote_average: 7.8,
        vote_count: 4200,
        popularity: 120
    };

    const person: PersonDetails = {
        id: 6384,
        indexer: "tmdb",
        name: "Keanu Reeves",
        biography:
            "Keanu Charles Reeves is a Canadian actor. Born in Beirut and raised in Toronto, he began acting in theatre productions and in television films before making his feature film debut in 1986.",
        birthday: "1964-09-02",
        deathday: null,
        place_of_birth: "Beirut, Lebanon",
        profile_path: null,
        known_for_department: "Acting",
        gender: "Male",
        popularity: 45.2,
        homepage: null,
        imdb_id: "nm0000206",
        tvdb_url: null,
        external_ids: { tmdb: "6384" },
        also_known_as: ["Keanu Charles Reeves"],
        cast_credits: [
            {
                ...baseCredits,
                id: 603692,
                title: "John Wick: Chapter 4",
                original_title: "John Wick: Chapter 4",
                character: "John Wick",
                media_type: "movie"
            },
            {
                ...baseCredits,
                id: 1,
                title: "The Matrix",
                original_title: "The Matrix",
                character: "Neo",
                media_type: "movie",
                release_date: "1999-03-31",
                year: 1999
            }
        ],
        crew_credits: []
    };

    const noCreditsPerson: PersonDetails = {
        ...person,
        id: 9999,
        name: "New Face",
        biography: null,
        birthday: null,
        place_of_birth: null,
        also_known_as: [],
        cast_credits: [],
        crew_credits: []
    };
</script>

<Story name="Default" args={{ data: { entity: person, user, permissions } }} />

<Story name="NoCredits" args={{ data: { entity: noCreditsPerson, user, permissions } }} />
