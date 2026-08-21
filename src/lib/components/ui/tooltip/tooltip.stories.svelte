<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import * as Tooltip from "./index.js";
    import { Button } from "$lib/components/ui/button/index.js";

    const { Story } = defineMeta({
        title: "ui/Tooltip",
        component: Tooltip.Root,
        tags: ["autodocs"]
    });
</script>

<Story name="Default" asChild>
    <Tooltip.Provider>
        <Tooltip.Root>
            <Tooltip.Trigger>
                {#snippet child({ props })}
                    <Button {...props} variant="outline">Hover me</Button>
                {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>
                <p>Add to library</p>
            </Tooltip.Content>
        </Tooltip.Root>
    </Tooltip.Provider>
</Story>
