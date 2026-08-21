<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import FormBase from "./form-base.svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";

    const { Story } = defineMeta({
        title: "auth/FormBase",
        component: FormBase,
        tags: ["autodocs"]
    });
</script>

<Story name="Default" asChild>
    <div class="w-full max-w-sm">
        <FormBase title="Change password" description="Update your account password.">
            {#snippet content()}
                <div class="space-y-2">
                    <Label for="password">New password</Label>
                    <Input id="password" type="password" />
                </div>
            {/snippet}
            {#snippet footer()}
                <Button type="submit">Save</Button>
            {/snippet}
        </FormBase>
    </div>
</Story>

<Story name="NoDescription" asChild>
    <div class="w-full max-w-sm">
        <FormBase title="Passkeys">
            {#snippet content()}
                <p class="text-muted-foreground text-sm">No passkeys registered yet.</p>
            {/snippet}
        </FormBase>
    </div>
</Story>
