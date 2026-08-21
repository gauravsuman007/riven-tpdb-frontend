<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import ProfilePage from "./+page.svelte";

    const { Story } = defineMeta({
        title: "pages/Profile",
        component: ProfilePage,
        tags: ["autodocs"]
    });
</script>

<script lang="ts">
    import { defaults } from "sveltekit-superforms";
    import { zod4 } from "sveltekit-superforms/adapters";
    import {
        passwordChangeSchema,
        emailChangeSchema,
        setPasswordSchema,
        changeUserDataSchema,
        createUserSchema
    } from "$lib/schemas/auth";
    import { getPermissionFlags } from "$lib/permissions";

    const user = {
        id: "1",
        name: "Alice Admin",
        email: "alice@example.com",
        image: null,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-06-01T00:00:00Z"
    };

    const session = {
        id: "session-1",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        expiresAt: "2099-01-01T00:00:00Z"
    };

    const baseData = {
        user,
        session,
        passwordChangeForm: defaults(zod4(passwordChangeSchema)),
        setPasswordForm: defaults(zod4(setPasswordSchema)),
        emailChangeForm: defaults(zod4(emailChangeSchema)),
        changeUserDataForm: defaults(zod4(changeUserDataSchema)),
        createUserForm: defaults(zod4(createUserSchema)),
        authProviders: {
            credential: { enabled: true, disableSignup: false },
            plex: { enabled: true, disableSignup: false, name: "Plex" }
        },
        managedUsers: []
    };

    const adminData = {
        ...baseData,
        permissions: getPermissionFlags("admin"),
        accounts: [
            {
                id: "1",
                userId: "1",
                providerId: "credential",
                createdAt: new Date("2024-01-01"),
                updatedAt: new Date("2024-01-01"),
                accountId: "alice",
                scopes: []
            }
        ],
        managedUsers: [
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
            }
        ]
    };

    const memberData = {
        ...baseData,
        permissions: getPermissionFlags("user"),
        accounts: [
            {
                id: "2",
                userId: "1",
                providerId: "plex",
                createdAt: new Date("2024-02-01"),
                updatedAt: new Date("2024-02-01"),
                accountId: "plex-456",
                scopes: []
            }
        ]
    };
</script>

<Story
    name="Admin"
    args={{ data: adminData }}
    parameters={{
        docs: {
            description: {
                story: "Signed in as an admin — sees the managed-users panel and password (not set-password) form since a credential account is linked."
            }
        }
    }} />

<Story
    name="Member"
    args={{ data: memberData }}
    parameters={{
        docs: {
            description: {
                story: "Signed in as a regular member without a linked credential account — shows the Set Password form instead of Change Password, and no user-management panel."
            }
        }
    }} />
