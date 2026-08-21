<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import DownloaderServicesGrid from "./downloader-services-grid.svelte";

    const { Story } = defineMeta({
        title: "dashboard/DownloaderServicesGrid",
        component: DownloaderServicesGrid,
        tags: ["autodocs"]
    });
</script>

<script lang="ts">
    import type { DownloaderService } from "./types";

    const services: DownloaderService[] = [
        {
            service: "Real-Debrid",
            email: "user@example.com",
            username: "rdUser",
            premium_status: "premium",
            premium_expires_at: "2025-12-31T00:00:00Z",
            premium_days_left: 120,
            points: 4500,
            total_downloaded_bytes: 1073741824000,
            cooldown_until: null
        },
        {
            service: "AllDebrid",
            email: null,
            username: "allDebridUser",
            premium_status: "free",
            premium_expires_at: null,
            premium_days_left: null,
            points: null,
            total_downloaded_bytes: 53687091200,
            cooldown_until: null
        },
        {
            service: "Premiumize",
            email: "user@example.com",
            username: null,
            premium_status: "premium",
            premium_expires_at: "2024-01-15T00:00:00Z",
            premium_days_left: 0,
            points: null,
            total_downloaded_bytes: 214748364800,
            cooldown_until: "2024-06-12T18:00:00Z"
        }
    ];
</script>

<Story name="Default" args={{ services }} />

<Story name="Empty" args={{ services: [] }} />
