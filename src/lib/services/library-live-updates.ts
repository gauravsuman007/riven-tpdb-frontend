import { notificationStore } from "$lib/stores/notifications.svelte";

function isMediaEvent(eventType: string) {
    return eventType.startsWith("riven.media-item.") || eventType.startsWith("riven.item-request.");
}

export function subscribeToMediaUpdates(
    refresh: () => void | Promise<void>,
    debounceMs = 250
): () => void {
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    function refreshSoon() {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
            if (!active) return;
            void refresh();
        }, debounceMs);
    }

    const unsubscribe = notificationStore.subscribe((event) => {
        if (isMediaEvent(event.eventType)) {
            refreshSoon();
        }
    });

    return () => {
        active = false;
        clearTimeout(refreshTimer);
        unsubscribe();
    };
}
