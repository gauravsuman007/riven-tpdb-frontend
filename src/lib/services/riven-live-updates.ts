import { gqlSubscribeClient } from "$lib/graphql-client";

/// Unified backend subscription that fans every relevant media-state event
/// (movie/show requested, show indexed, item scraped/downloaded/failed,
/// items deleted) onto a single multipart stream. One connection replaces
/// eight individual subscriptions, which keeps the home/library/dashboard
/// pages under the per-origin connection cap on HTTP/1.1 deployments and
/// cuts subscription-side server work by ~8x on every transport.
const MEDIA_EVENTS_SUBSCRIPTION = `subscription RivenMediaEvents {
    mediaEvents { kind itemId }
}`;

type MediaEventPayload = {
    mediaEvents: { kind: string; itemId: number | null };
};

export function subscribeToRivenMediaEvents(
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

    const unsubscribe = gqlSubscribeClient<MediaEventPayload>(
        MEDIA_EVENTS_SUBSCRIPTION,
        undefined,
        {
            onData: refreshSoon,
            onError: () => {
                // Callers keep their last successful data snapshot. The shared GraphQL
                // subscription client owns transport-level retry behaviour where needed.
            }
        }
    );

    return () => {
        active = false;
        clearTimeout(refreshTimer);
        unsubscribe();
    };
}
