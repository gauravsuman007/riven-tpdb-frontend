<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import ItemAction from "./item-action.svelte";

    const { Story } = defineMeta({
        title: "media/riven/ItemAction",
        component: ItemAction,
        tags: ["autodocs"],
        args: {
            title: "John Wick: Chapter 4",
            ids: ["123"]
        }
    });
</script>

<Story name="Reset" args={{ kind: "reset" }} />

<Story name="Retry" args={{ kind: "retry" }} />

<Story name="Delete" args={{ kind: "delete", variant: "destructive" }} />

<Story name="PauseActive" args={{ kind: "pause", isPaused: false }} />

<Story name="PausePaused" args={{ kind: "pause", isPaused: true }} />
