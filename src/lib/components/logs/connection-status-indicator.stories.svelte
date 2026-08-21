<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import ConnectionStatusIndicator from "./connection-status-indicator.svelte";

    const { Story } = defineMeta({
        title: "logs/ConnectionStatusIndicator",
        component: ConnectionStatusIndicator,
        tags: ["autodocs"],
        args: {
            reconnectAttempts: 0,
            maxReconnectAttempts: 5
        }
    });
</script>

<Story name="Connected" args={{ connectionStatus: "connected" }} />

<Story name="Connecting" args={{ connectionStatus: "connecting" }} />

<Story name="Reconnecting" args={{ connectionStatus: "connecting", reconnectAttempts: 2 }} />

<Story name="Disconnected" args={{ connectionStatus: "disconnected" }} />

<Story name="Error" args={{ connectionStatus: "error" }} />
