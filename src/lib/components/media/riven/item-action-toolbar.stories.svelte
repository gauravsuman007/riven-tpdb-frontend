<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import ItemActionToolbar from "./item-action-toolbar.svelte";
    import { fn } from "storybook/test";

    const { Story } = defineMeta({
        title: "media/riven/ItemActionToolbar",
        component: ItemActionToolbar,
        tags: ["autodocs"],
        parameters: {
            docs: {
                description: {
                    component:
                        "Renders the request/reset/retry/pause/delete/raw-data action row shown on the media details page. All buttons are inert by default — mutations only fire on click."
                }
            }
        },
        args: {
            title: "John Wick: Chapter 4",
            mediaType: "movie",
            externalId: "603692",
            seasons: [],
            riven: undefined,
            rivenId: undefined,
            rivenPending: false,
            onRequestSuccess: fn(),
            onActionSuccess: fn(),
            rawDataOpen: false,
            rawRivenLoading: false,
            rawRivenError: undefined,
            rawRivenJson: undefined
        }
    });
</script>

<Story name="NotRequested" />

<Story
    name="RequestedMovie"
    args={{
        riven: { id: 42, state: "Completed" },
        rivenId: 42
    }} />

<Story
    name="RequestedTvShow"
    args={{
        mediaType: "tv",
        riven: { id: 43, state: "Ongoing" },
        rivenId: 43,
        seasons: [
            { id: 1, season_number: 1, episode_count: 9, name: "Season 1" },
            { id: 2, season_number: 2, episode_count: 9, name: "Season 2" }
        ]
    }} />

<Story
    name="Paused"
    args={{
        riven: { id: 44, state: "Paused" },
        rivenId: 44
    }} />

<Story
    name="RawDataOpen"
    args={{
        riven: { id: 42, state: "Completed" },
        rivenId: 42,
        rawDataOpen: true,
        rawRivenJson: JSON.stringify({ id: 42, state: "Completed" }, null, 2)
    }} />
