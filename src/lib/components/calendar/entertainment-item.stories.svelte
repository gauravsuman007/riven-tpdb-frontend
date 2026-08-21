<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import EntertainmentItem from "./entertainment-item.svelte";

    const { Story } = defineMeta({
        title: "calendar/EntertainmentItem",
        component: EntertainmentItem,
        tags: ["autodocs"]
    });
</script>

<script lang="ts">
    import type { EntertainmentItem as EntertainmentItemType } from "./types";

    const movie: EntertainmentItemType = {
        item_id: 1,
        tvdb_id: "",
        tmdb_id: "603692",
        show_title: "John Wick: Chapter 4",
        item_type: "movie",
        aired_at: "2023-03-24"
    };

    const episode: EntertainmentItemType = {
        item_id: 2,
        tvdb_id: "121361",
        tmdb_id: "1399",
        show_title: "Game of Thrones",
        item_type: "episode",
        aired_at: "2019-04-14",
        season: 8,
        episode: 1
    };

    const show: EntertainmentItemType = {
        item_id: 3,
        tvdb_id: "371572",
        tmdb_id: "94605",
        show_title: "Arcane",
        item_type: "show",
        aired_at: "2024-11-09"
    };

    const completedEpisode: EntertainmentItemType = {
        ...episode,
        item_id: 4,
        last_state: "Completed"
    };
</script>

<Story name="Movie" args={{ item: movie }} />

<Story name="Episode" args={{ item: episode }} />

<Story name="Show" args={{ item: show }} />

<Story name="Completed" args={{ item: completedEpisode }} />

<Story name="Compact" args={{ item: episode, compact: true }} />

<Story name="AllTypesCompact" asChild>
    <div class="flex w-64 flex-col gap-1.5">
        <EntertainmentItem item={movie} compact />
        <EntertainmentItem item={episode} compact />
        <EntertainmentItem item={show} compact />
    </div>
</Story>
