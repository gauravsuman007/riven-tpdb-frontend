<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import ServiceStatusCard from "./service-status-card.svelte";

    const { Story } = defineMeta({
        title: "dashboard/ServiceStatusCard",
        component: ServiceStatusCard,
        tags: ["autodocs"]
    });
</script>

<Story
    name="Default"
    args={{
        statuses: {
            Plex: true,
            "Real-Debrid": true,
            Overseerr: false,
            Prowlarr: true,
            Jackett: null
        }
    }} />

<Story name="Empty" args={{ statuses: null }} />
