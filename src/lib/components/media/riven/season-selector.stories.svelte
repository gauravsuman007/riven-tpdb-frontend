<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import SeasonSelector from "./season-selector.svelte";
    import { fn } from "storybook/test";

    const { Story } = defineMeta({
        title: "media/riven/SeasonSelector",
        component: SeasonSelector,
        tags: ["autodocs"],
        parameters: {
            layout: "centered"
        }
    });
</script>

<script lang="ts">
    import type { SeasonInfo } from "./season-selector.svelte";

    const seasons: SeasonInfo[] = [
        { id: 1, season_number: 1, episode_count: 9, completed_count: 9, name: "Season 1" },
        {
            id: 2,
            season_number: 2,
            episode_count: 9,
            completed_count: 4,
            name: "Season 2",
            status: "Ongoing"
        },
        {
            id: 3,
            season_number: 3,
            episode_count: 8,
            completed_count: 0,
            name: "Season 3",
            status: "Available"
        }
    ];
</script>

<Story name="Default" asChild>
    <div class="w-64">
        <SeasonSelector {seasons} selectedSeasons={[1, 2]} onToggle={fn()} />
    </div>
</Story>

<Story name="NoneSelected" asChild>
    <div class="w-64">
        <SeasonSelector {seasons} selectedSeasons={[]} onToggle={fn()} />
    </div>
</Story>
