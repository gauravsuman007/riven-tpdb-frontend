import { gqlSubscribeClient } from "$lib/graphql-client";

const LIBRARY_EVENTS_SUBSCRIPTION = `subscription LibraryEvents {
    notifications {
        eventType
    }
}`;

function isLibraryEvent(eventType: string) {
    return eventType.startsWith("riven.media-item.") || eventType.startsWith("riven.item-request.");
}

export function subscribeToLibraryUpdates(
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

    const unsubscribe = gqlSubscribeClient<{ notifications: { eventType: string } }>(
        LIBRARY_EVENTS_SUBSCRIPTION,
        undefined,
        {
            onData: ({ notifications }) => {
                if (isLibraryEvent(notifications.eventType)) {
                    refreshSoon();
                }
            }
        }
    );

    return () => {
        active = false;
        clearTimeout(refreshTimer);
        unsubscribe();
    };
}
