<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import LogEntryRow from "./log-entry-row.svelte";

    const { Story } = defineMeta({
        title: "logs/LogEntryRow",
        component: LogEntryRow,
        tags: ["autodocs"]
    });
</script>

<Story
    name="Info"
    args={{
        log: {
            timestamp: "2024-06-12 10:32:01",
            level: "info",
            target: "riven::server",
            message: "Server started successfully"
        }
    }} />

<Story
    name="Error"
    args={{
        log: {
            timestamp: "2024-06-12 10:32:05",
            level: "error",
            target: "riven::scraper",
            message: "Failed to connect to indexer: connection timed out"
        }
    }} />

<Story
    name="Warn"
    args={{
        log: {
            timestamp: "2024-06-12 10:32:10",
            level: "warn",
            target: "riven::db",
            message: "Slow query detected (312ms)"
        }
    }} />

<Story
    name="Debug"
    args={{
        log: {
            timestamp: "2024-06-12 10:32:15",
            level: "debug",
            target: "riven::graphql",
            message: "Resolved query in 4ms"
        }
    }} />
