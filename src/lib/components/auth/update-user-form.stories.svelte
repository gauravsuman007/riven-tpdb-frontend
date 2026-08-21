<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import UpdateUserForm from "./update-user-form.svelte";

    const { Story } = defineMeta({
        title: "auth/UpdateUserForm",
        component: UpdateUserForm,
        tags: ["autodocs"]
    });
</script>

<script lang="ts">
    import { defaults } from "sveltekit-superforms";
    import { zod4 } from "sveltekit-superforms/adapters";
    import { changeUserDataSchema } from "$lib/schemas/auth";

    const data = defaults(
        { newUsername: "alice", newName: "Alice Admin", newAvatar: "" },
        zod4(changeUserDataSchema)
    );
</script>

<Story name="Default" args={{ data }} />
