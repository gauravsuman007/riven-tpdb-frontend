<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import Tooltip from "./tooltip.svelte";
    import { Button } from "$lib/components/ui/button/index.js";

    const { Story } = defineMeta({
        title: "components/Tooltip",
        component: Tooltip,
        tags: ["autodocs"]
    });
</script>

<Story name="Default" asChild>
    <Tooltip>
        {#snippet trigger()}
            <Button variant="outline">Hover me</Button>
        {/snippet}
        {#snippet content()}
            Add to library
        {/snippet}
    </Tooltip>
</Story>
