<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import LiveLogLine from "./live-log-line.svelte";

    const { Story } = defineMeta({
        title: "logs/LiveLogLine",
        component: LiveLogLine,
        tags: ["autodocs"]
    });
</script>

<Story
    name="Default"
    args={{ line: "[2024-06-12 10:32:01] Riven started successfully on port 8080" }} />

<Story
    name="LongLine"
    args={{
        line: "[2024-06-12 10:32:05] Processing 42 items from queue: John Wick Chapter 4, The Batman, Dune Part Two, Oppenheimer, Everything Everywhere All at Once..."
    }} />
