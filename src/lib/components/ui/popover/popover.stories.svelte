<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import * as Popover from "./index.js";
    import { Button } from "$lib/components/ui/button/index.js";

    const { Story } = defineMeta({
        title: "ui/Popover",
        component: Popover.Root,
        tags: ["autodocs"],
        parameters: {
            layout: "centered"
        }
    });
</script>

<Story name="Default" asChild>
    <Popover.Root>
        <Popover.Trigger>
            {#snippet child({ props })}
                <Button {...props} variant="outline">Open Popover</Button>
            {/snippet}
        </Popover.Trigger>
        <Popover.Content class="w-72">
            <div class="grid gap-2">
                <Popover.Title class="font-medium">Dimensions</Popover.Title>
                <Popover.Description class="text-muted-foreground text-sm">
                    Set the dimensions for the layer.
                </Popover.Description>
            </div>
        </Popover.Content>
    </Popover.Root>
</Story>
