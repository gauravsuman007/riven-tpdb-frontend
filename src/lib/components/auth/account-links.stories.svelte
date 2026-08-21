<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import AccountLinks from "./account-links.svelte";

    const { Story } = defineMeta({
        title: "auth/AccountLinks",
        component: AccountLinks,
        tags: ["autodocs"],
        args: {
            providers: {
                credential: { enabled: true, disableSignup: false },
                plex: { enabled: true, disableSignup: false, name: "Plex" },
                authentik: { enabled: true, disableSignup: false, name: "Authentik" }
            }
        }
    });
</script>

<Story
    name="OneLinked"
    args={{
        accounts: [
            {
                id: "1",
                providerId: "plex",
                createdAt: new Date("2024-01-01"),
                updatedAt: new Date("2024-01-01"),
                accountId: "plex-123",
                scopes: []
            }
        ]
    }} />

<Story name="NoneLinked" args={{ accounts: [] }} />
