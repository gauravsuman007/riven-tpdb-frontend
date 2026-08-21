<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import ErrorDisplay from "./error-display.svelte";
    import { fn } from "storybook/test";

    const { Story } = defineMeta({
        title: "logs/ErrorDisplay",
        component: ErrorDisplay,
        tags: ["autodocs"],
        args: {
            errorMessage: "WebSocket connection refused: connect ECONNREFUSED 127.0.0.1:8080",
            retryAction: fn()
        }
    });
</script>

<Story name="Default" />

<Story name="CustomButtonText" args={{ buttonText: "Reconnect" }} />
