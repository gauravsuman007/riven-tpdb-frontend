<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import EmptyState from "./empty-state.svelte";
    import { fn } from "storybook/test";

    const { Story } = defineMeta({
        title: "logs/EmptyState",
        component: EmptyState,
        tags: ["autodocs"]
    });
</script>

<Story name="MessageOnly" args={{ message: "Connected. Waiting for live logs..." }} />

<Story
    name="WithAction"
    args={{ message: "No historical logs found", actionText: "Refresh", actionFn: fn() }} />
