import type { ConnectionStatus } from "$lib/stores/logs.svelte";

export function getConnectionStatusColor(status: ConnectionStatus): string {
    switch (status) {
        case "connected":
            return "bg-green-500";
        case "connecting":
            return "bg-yellow-500";
        case "disconnected":
            return "bg-gray-500";
        case "error":
            return "bg-red-500";
        default:
            return "bg-gray-500";
    }
}

export function getConnectionStatusText(
    status: ConnectionStatus,
    reconnectAttempts: number,
    maxReconnectAttempts: number
): string {
    switch (status) {
        case "connected":
            return "Connected";
        case "connecting":
            return reconnectAttempts > 0
                ? `Reconnecting... (${reconnectAttempts}/${maxReconnectAttempts})`
                : "Connecting...";
        case "disconnected":
            return "Disconnected";
        case "error":
            return "Connection Error";
        default:
            return "Unknown";
    }
}
