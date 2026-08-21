<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import * as Sheet from "./index.js";
    import { Button } from "$lib/components/ui/button/index.js";

    const { Story } = defineMeta({
        title: "ui/Sheet",
        component: Sheet.Root,
        tags: ["autodocs"]
    });
</script>

<Story name="Default" asChild>
    <Sheet.Root>
        <Sheet.Trigger>
            {#snippet child({ props })}
                <Button {...props} variant="outline">Open Sheet</Button>
            {/snippet}
        </Sheet.Trigger>
        <Sheet.Content>
            <Sheet.Header>
                <Sheet.Title>Edit profile</Sheet.Title>
                <Sheet.Description>
                    Make changes to your profile here. Click save when you're done.
                </Sheet.Description>
            </Sheet.Header>
            <Sheet.Footer>
                <Button type="submit">Save changes</Button>
            </Sheet.Footer>
        </Sheet.Content>
    </Sheet.Root>
</Story>
