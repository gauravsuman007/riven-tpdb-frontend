<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import { toast } from "svelte-sonner";
    import { logStore } from "$lib/stores/logs.svelte";
    import { createScopedLogger } from "$lib/logger";
    import PageShell from "$lib/components/page-shell.svelte";
    import LiveLogLineRow from "$lib/components/logs/live-log-line.svelte";
    import LogEntryRow from "$lib/components/logs/log-entry-row.svelte";
    import ConnectionStatusIndicator from "$lib/components/logs/connection-status-indicator.svelte";
    import LogTabButton from "$lib/components/logs/log-tab-button.svelte";
    import LoadingSpinner from "$lib/components/logs/loading-spinner.svelte";
    import ErrorDisplay from "$lib/components/logs/error-display.svelte";
    import EmptyState from "$lib/components/logs/empty-state.svelte";
    import { getConnectionStatusText } from "$lib/components/logs/helpers";

    const logger = createScopedLogger("logs-page");

    const {
        logs,
        historicalLogs,
        isLoadingHistorical,
        activeTab,
        error,
        historicalError,
        connectionStatus,
        hasConnected,
        reconnectAttempts,
        maxReconnectAttempts
    } = $derived({
        logs: logStore.logs,
        historicalLogs: logStore.historicalLogs,
        isLoadingHistorical: logStore.isLoadingHistorical,
        activeTab: logStore.activeTab,
        error: logStore.error,
        historicalError: logStore.historicalError,
        connectionStatus: logStore.connectionStatus,
        hasConnected: logStore.hasConnected,
        reconnectAttempts: logStore.reconnectAttempts,
        maxReconnectAttempts: logStore.maxReconnectAttempts
    });

    onMount(() => {
        logStore.connect();
    });

    onDestroy(() => {
        logStore.disconnect();
    });

    async function handleUploadLogs() {
        try {
            toast.info("Log upload is not supported in the new backend.");
        } catch (e) {
            logger.error("Failed to upload logs:", e);
        }
    }
</script>

<svelte:head>
    <title>Logs - Riven</title>
</svelte:head>

<PageShell class="h-full">
    {#if error && connectionStatus === "error" && reconnectAttempts >= maxReconnectAttempts}
        <div class="bg-destructive/10 border-destructive/20 rounded-lg border p-6">
            <h3 class="text-destructive mb-3 text-lg font-semibold">Connection Failed</h3>
            <pre
                class="text-destructive/80 bg-destructive/5 mb-4 overflow-x-auto rounded border p-3 font-mono text-sm">{error}</pre>
            <button
                class="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 font-medium transition-colors"
                onclick={() => logStore.reconnect()}>
                Try Again
            </button>
        </div>
    {:else if logs.length > 0 || historicalLogs.length > 0 || connectionStatus !== "disconnected" || isLoadingHistorical}
        <div class="flex h-full min-h-0 flex-col">
            <div class="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row">
                <div>
                    <h1 class="text-3xl font-bold tracking-tight">System Logs</h1>
                    <p class="text-muted-foreground mt-1">System monitoring and logs</p>
                </div>
                <div class="flex items-center gap-4">
                    <Button variant="secondary" onclick={handleUploadLogs}>Upload Logs</Button>
                    <div
                        class="bg-primary/10 text-primary border-primary/20 rounded-lg border px-4 py-2 font-medium">
                        {activeTab === "live" ? logs.length : historicalLogs.length} entries
                    </div>
                </div>
            </div>

            <div class="bg-card flex min-h-0 flex-1 flex-col rounded-lg border shadow-sm">
                <div
                    class="bg-muted/30 flex shrink-0 flex-col items-center justify-between gap-4 border-b px-6 py-3 md:flex-row">
                    <div class="flex items-center gap-2">
                        <LogTabButton
                            name="Live Logs"
                            isActive={activeTab === "live"}
                            onclick={() => logStore.setActiveTab("live")} />
                        <LogTabButton
                            name="Historical Logs"
                            isActive={activeTab === "historical"}
                            onclick={() => logStore.setActiveTab("historical")} />
                    </div>
                    <div class="flex items-center gap-4">
                        {#if activeTab === "live"}
                            <ConnectionStatusIndicator
                                {connectionStatus}
                                {reconnectAttempts}
                                {maxReconnectAttempts} />
                            {#if connectionStatus === "error" && reconnectAttempts < maxReconnectAttempts}
                                <button
                                    class="bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 rounded border px-3 py-1 text-sm font-medium transition-colors"
                                    onclick={() => logStore.reconnect()}>
                                    Reconnect Now
                                </button>
                            {/if}
                        {:else}
                            <button
                                class="bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 rounded border px-3 py-1 text-sm font-medium transition-colors"
                                onclick={() => logStore.fetchHistoricalLogs()}
                                disabled={isLoadingHistorical}>
                                {isLoadingHistorical ? "Loading..." : "Refresh"}
                            </button>
                        {/if}
                    </div>
                </div>

                <div class="min-h-0 flex-1 overflow-y-auto">
                    {#if activeTab === "live"}
                        {#if logs.length > 0}
                            {#each logs.slice().reverse() as line, i (i)}
                                <LiveLogLineRow {line} />
                            {/each}
                        {:else if connectionStatus === "connecting"}
                            <LoadingSpinner
                                message={getConnectionStatusText(
                                    connectionStatus,
                                    reconnectAttempts,
                                    maxReconnectAttempts
                                )} />
                        {:else if connectionStatus === "connected" || hasConnected}
                            <EmptyState message="Connected. Waiting for live logs..." />
                        {:else if error}
                            <div class="p-8">
                                <ErrorDisplay
                                    errorMessage={error}
                                    retryAction={() => logStore.reconnect()}
                                    buttonText="Reconnect" />
                            </div>
                        {/if}
                    {:else if isLoadingHistorical}
                        <LoadingSpinner message="Loading historical logs..." />
                    {:else if historicalError}
                        <div class="p-8">
                            <ErrorDisplay
                                errorMessage={historicalError}
                                retryAction={() => logStore.fetchHistoricalLogs()} />
                        </div>
                    {:else if historicalLogs.length > 0}
                        {#each historicalLogs.slice().reverse() as log, i (i)}
                            <LogEntryRow {log} />
                        {/each}
                    {:else}
                        <EmptyState
                            message="No historical logs found"
                            actionText="Refresh"
                            actionFn={() => logStore.fetchHistoricalLogs()} />
                    {/if}
                </div>
            </div>
        </div>
    {:else}
        <div class="flex h-full flex-col items-center justify-center">
            <div class="bg-card max-w-md rounded-lg border p-8 text-center shadow-sm">
                <div
                    class="border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-t-transparent">
                </div>
                <h3 class="mb-2 text-lg font-semibold">Connecting to Logs</h3>
                <p class="text-muted-foreground text-sm">
                    Establishing connection to log server...
                </p>
            </div>
        </div>
    {/if}
</PageShell>
