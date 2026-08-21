<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import * as AlertDialog from "./index.js";
    import { Button } from "$lib/components/ui/button/index.js";

    const { Story } = defineMeta({
        title: "ui/AlertDialog",
        component: AlertDialog.Root,
        tags: ["autodocs"]
    });
</script>

<Story name="Default" asChild>
    <AlertDialog.Root>
        <AlertDialog.Trigger>
            {#snippet child({ props })}
                <Button {...props} variant="outline">Delete account</Button>
            {/snippet}
        </AlertDialog.Trigger>
        <AlertDialog.Content>
            <AlertDialog.Header>
                <AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
                <AlertDialog.Description>
                    This action cannot be undone. This will permanently delete your account and
                    remove your data from our servers.
                </AlertDialog.Description>
            </AlertDialog.Header>
            <AlertDialog.Footer>
                <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                <AlertDialog.Action>Continue</AlertDialog.Action>
            </AlertDialog.Footer>
        </AlertDialog.Content>
    </AlertDialog.Root>
</Story>
