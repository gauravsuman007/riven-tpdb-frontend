<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import LogsPage from "./+page.svelte";

    const { Story } = defineMeta({
        title: "pages/Logs",
        component: LogsPage,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen",
            docs: {
                description: {
                    component:
                        "`logStore` is a module-level singleton connected to a live WebSocket (`connect()` on mount), not an injectable prop — same limitation as `NotificationCenter`. With no backend available in Storybook the connection never completes and the page falls back to its real 'Connecting to Logs' state."
                }
            }
        }
    });
</script>

<Story name="Default" />
