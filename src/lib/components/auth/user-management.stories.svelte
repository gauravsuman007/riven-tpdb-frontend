<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import UserManagement from "./user-management.svelte";

    const { Story } = defineMeta({
        title: "auth/UserManagement",
        component: UserManagement,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen"
        }
    });
</script>

<script lang="ts">
    import { defaults } from "sveltekit-superforms";
    import { zod4 } from "sveltekit-superforms/adapters";
    import { createUserSchema } from "$lib/schemas/auth";

    const formData = defaults(zod4(createUserSchema));

    const users = [
        {
            id: "1",
            name: "Alice Admin",
            email: "alice@example.com",
            username: "alice",
            role: "admin",
            banned: false,
            createdAt: "2024-01-01T00:00:00Z"
        },
        {
            id: "2",
            name: "Bob Viewer",
            email: "bob@example.com",
            username: "bob",
            role: "user",
            banned: false,
            createdAt: "2024-03-15T00:00:00Z"
        },
        {
            id: "3",
            name: "Charlie Banned",
            email: "charlie@example.com",
            username: "charlie",
            role: "user",
            banned: true,
            createdAt: "2024-02-01T00:00:00Z"
        }
    ];
</script>

<Story name="Default" args={{ formData, users, currentUserId: "1" }} />
