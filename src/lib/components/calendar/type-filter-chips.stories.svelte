<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import TypeFilterChips from "./type-filter-chips.svelte";

    const { Story } = defineMeta({
        title: "calendar/TypeFilterChips",
        component: TypeFilterChips,
        tags: ["autodocs"]
    });
</script>

<script lang="ts">
    import Film from "@lucide/svelte/icons/film";
    import Tv from "@lucide/svelte/icons/tv";
    import type { FilterOption } from "./types";

    const options: FilterOption[] = [
        { id: "movies", label: "Movies", type: "movie", icon: Film },
        { id: "episodes", label: "Episodes", type: "episode", icon: Tv },
        { id: "shows", label: "Shows", type: "show", icon: Tv },
        { id: "seasons", label: "Seasons", type: "season", icon: Tv }
    ];
</script>

<Story
    name="AllSelected"
    args={{ options, filters: { movie: true, episode: true, show: true, season: true } }} />

<Story
    name="SomeSelected"
    args={{ options, filters: { movie: true, episode: false, show: true, season: false } }} />
