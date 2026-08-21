<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import UsenetProvidersCard from "./usenet-providers-card.svelte";

    const { Story } = defineMeta({
        title: "dashboard/UsenetProvidersCard",
        component: UsenetProvidersCard,
        tags: ["autodocs"]
    });
</script>

<script lang="ts">
    import type { NntpProviderHealth } from "./types";

    const providers: NntpProviderHealth[] = [
        {
            host: "news.provider-a.com",
            port: 563,
            priority: 0,
            isBackup: false,
            maxConnections: 50,
            openConnections: 32,
            idleConnections: 8,
            activeConnections: 24,
            demoted: false,
            consecutiveNotFound: 0
        },
        {
            host: "news.provider-b.com",
            port: 563,
            priority: 1,
            isBackup: true,
            maxConnections: 20,
            openConnections: 4,
            idleConnections: 4,
            activeConnections: 0,
            demoted: true,
            consecutiveNotFound: 12
        }
    ];
</script>

<Story name="Default" args={{ providers }} />

<Story name="Empty" args={{ providers: [] }} />
