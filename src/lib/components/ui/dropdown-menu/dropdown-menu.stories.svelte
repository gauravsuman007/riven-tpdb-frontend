<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import * as DropdownMenu from "./index.js";
    import { Button } from "$lib/components/ui/button/index.js";

    const { Story } = defineMeta({
        title: "ui/DropdownMenu",
        component: DropdownMenu.Root,
        tags: ["autodocs"]
    });
</script>

<Story name="Default" asChild>
    <DropdownMenu.Root>
        <DropdownMenu.Trigger>
            {#snippet child({ props })}
                <Button {...props} variant="outline">Open Menu</Button>
            {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content class="w-56">
            <DropdownMenu.Group>
                <DropdownMenu.GroupHeading>My Account</DropdownMenu.GroupHeading>
                <DropdownMenu.Separator />
                <DropdownMenu.Item>Profile</DropdownMenu.Item>
                <DropdownMenu.Item>Billing</DropdownMenu.Item>
                <DropdownMenu.Item>Settings</DropdownMenu.Item>
            </DropdownMenu.Group>
            <DropdownMenu.Separator />
            <DropdownMenu.Item>Log out</DropdownMenu.Item>
        </DropdownMenu.Content>
    </DropdownMenu.Root>
</Story>
