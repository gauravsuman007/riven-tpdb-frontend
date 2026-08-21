<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import EmailChangeForm from "./email-change-form.svelte";

    const { Story } = defineMeta({
        title: "auth/EmailChangeForm",
        component: EmailChangeForm,
        tags: ["autodocs"]
    });
</script>

<script lang="ts">
    import { defaults } from "sveltekit-superforms";
    import { zod4 } from "sveltekit-superforms/adapters";
    import { emailChangeSchema } from "$lib/schemas/auth";

    const data = defaults(zod4(emailChangeSchema));
</script>

<Story name="Default" args={{ data }} />
