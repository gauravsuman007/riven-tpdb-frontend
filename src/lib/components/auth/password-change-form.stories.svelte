<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import PasswordChangeForm from "./password-change-form.svelte";

    const { Story } = defineMeta({
        title: "auth/PasswordChangeForm",
        component: PasswordChangeForm,
        tags: ["autodocs"]
    });
</script>

<script lang="ts">
    import { defaults } from "sveltekit-superforms";
    import { zod4 } from "sveltekit-superforms/adapters";
    import { passwordChangeSchema } from "$lib/schemas/auth";

    const data = defaults(zod4(passwordChangeSchema));
</script>

<Story name="Default" args={{ data }} />
