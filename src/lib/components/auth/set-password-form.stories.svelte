<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import SetPasswordForm from "./set-password-form.svelte";

    const { Story } = defineMeta({
        title: "auth/SetPasswordForm",
        component: SetPasswordForm,
        tags: ["autodocs"]
    });
</script>

<script lang="ts">
    import { defaults } from "sveltekit-superforms";
    import { zod4 } from "sveltekit-superforms/adapters";
    import { setPasswordSchema } from "$lib/schemas/auth";

    const data = defaults(zod4(setPasswordSchema));
</script>

<Story name="Default" args={{ data }} />
