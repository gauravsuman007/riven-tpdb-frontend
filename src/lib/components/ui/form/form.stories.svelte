<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import Field from "./form-field.svelte";
    import * as Form from "./index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { superForm, defaults } from "sveltekit-superforms";
    import { zod4, zod4Client } from "sveltekit-superforms/adapters";
    import { loginSchema } from "$lib/schemas/auth";

    const { Story } = defineMeta({
        title: "ui/Form",
        component: Field,
        tags: ["autodocs"]
    });
</script>

<script lang="ts">
    // Storybook has no SvelteKit server load, so the SuperValidated object is
    // built client-side via `defaults()` instead of a real form action round-trip.
    // `superForm` reads Svelte context, so this must run during component
    // initialization rather than at module scope.
    const form = superForm(defaults(zod4(loginSchema)), {
        validators: zod4Client(loginSchema),
        SPA: true
    });
    const { form: formData } = form;
</script>

<Story name="Default" asChild>
    <form class="flex w-full max-w-sm flex-col gap-4">
        <Form.Field {form} name="username">
            <Form.Control>
                {#snippet children({ props })}
                    <Form.Label>Username</Form.Label>
                    <Input {...props} bind:value={$formData.username} />
                {/snippet}
            </Form.Control>
            <Form.Description>This is your public display name.</Form.Description>
            <Form.FieldErrors />
        </Form.Field>
        <Form.Field {form} name="password">
            <Form.Control>
                {#snippet children({ props })}
                    <Form.Label>Password</Form.Label>
                    <Input {...props} type="password" bind:value={$formData.password} />
                {/snippet}
            </Form.Control>
            <Form.FieldErrors />
        </Form.Field>
        <Button type="submit">Submit</Button>
    </form>
</Story>
