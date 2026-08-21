<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import * as Dialog from "./index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";

    const { Story } = defineMeta({
        title: "ui/Dialog",
        component: Dialog.Root,
        tags: ["autodocs"]
    });
</script>

<Story name="Default" asChild>
    <Dialog.Root>
        <Dialog.Trigger>
            {#snippet child({ props })}
                <Button {...props} variant="outline">Edit Profile</Button>
            {/snippet}
        </Dialog.Trigger>
        <Dialog.Content>
            <Dialog.Header>
                <Dialog.Title>Edit profile</Dialog.Title>
                <Dialog.Description>
                    Make changes to your profile here. Click save when you're done.
                </Dialog.Description>
            </Dialog.Header>
            <div class="grid gap-4 py-4">
                <div class="grid gap-2">
                    <Label for="name">Name</Label>
                    <Input id="name" value="Pedro Duarte" />
                </div>
                <div class="grid gap-2">
                    <Label for="username">Username</Label>
                    <Input id="username" value="@peduarte" />
                </div>
            </div>
            <Dialog.Footer>
                <Button type="submit">Save changes</Button>
            </Dialog.Footer>
        </Dialog.Content>
    </Dialog.Root>
</Story>
