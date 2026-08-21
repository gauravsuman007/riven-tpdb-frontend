<script lang="ts">
    import type { ConnectionStatus } from "$lib/stores/logs.svelte";
    import { getConnectionStatusColor, getConnectionStatusText } from "./helpers";

    let {
        connectionStatus,
        reconnectAttempts,
        maxReconnectAttempts
    }: {
        connectionStatus: ConnectionStatus;
        reconnectAttempts: number;
        maxReconnectAttempts: number;
    } = $props();

    const statusColor = $derived(getConnectionStatusColor(connectionStatus));
    const statusText = $derived(
        getConnectionStatusText(connectionStatus, reconnectAttempts, maxReconnectAttempts)
    );
</script>

<div class="flex items-center gap-2">
    <div
        class="{statusColor} h-2 w-2 rounded-full {connectionStatus === 'connecting'
            ? 'animate-pulse'
            : ''}">
    </div>
    <span class="text-muted-foreground text-sm">{statusText}</span>
</div>
