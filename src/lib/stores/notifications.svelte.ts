import { gqlSubscribeClient } from "$lib/graphql-client";
import { createScopedLogger } from "$lib/logger";
import { SvelteSet } from "svelte/reactivity";

const logger = createScopedLogger("notifications");

export type Notification = {
    id: string;
    title: string;
    message: string;
    timestamp: string;
    type: "movie" | "show" | "season" | "episode";
    severity: "success" | "warning" | "error";
    year?: number;
    duration?: number;
    imdb_id?: string;
    read: boolean;
};

// Shape of a RivenNotification as returned by the GraphQL `notifications` subscription.
export type RivenNotificationPayload = {
    eventType: string;
    title?: string | null;
    fullTitle?: string | null;
    itemType?: string | null;
    year?: number | null;
    imdbId?: string | null;
    tmdbId?: string | null;
    tvdbId?: string | null;
    durationSeconds?: number | null;
    id?: number | null;
    streamCount?: number | null;
    count?: number | null;
    newItems?: number | null;
    error?: string | null;
};

const NOTIFICATIONS_SUBSCRIPTION = `subscription {
    notifications {
        eventType title fullTitle itemType year imdbId tmdbId tvdbId
        durationSeconds id streamCount count newItems error
    }
}`;

function mapItemType(raw?: string | null): "movie" | "show" | "season" | "episode" {
    switch (raw?.toLowerCase()) {
        case "movie":
            return "movie";
        case "show":
            return "show";
        case "season":
            return "season";
        case "episode":
            return "episode";
        default:
            return "movie";
    }
}

function rivenNotificationToNotification(
    event: RivenNotificationPayload
): Omit<Notification, "id" | "read"> | null {
    const ts = new Date().toISOString();

    switch (event.eventType) {
        case "riven.media-item.download.success":
            return {
                title: event.fullTitle ?? event.title ?? "Unknown",
                message: `Download complete${event.year ? ` (${event.year})` : ""}`,
                severity: "success",
                timestamp: ts,
                type: mapItemType(event.itemType),
                year: event.year ?? undefined,
                duration: event.durationSeconds
                    ? Math.round(event.durationSeconds / 60)
                    : undefined,
                imdb_id: event.imdbId ?? undefined
            };

        case "riven.media-item.scrape.success":
            return {
                title: event.title ?? "Unknown",
                message: `Found ${event.streamCount ?? 0} stream(s)`,
                severity: "success",
                timestamp: ts,
                type: mapItemType(event.itemType)
            };

        case "riven.media-item.index.success":
            return {
                title: event.title ?? "Unknown",
                message: "Indexed successfully",
                severity: "success",
                timestamp: ts,
                type: mapItemType(event.itemType)
            };

        case "riven.item-request.create.success":
            return {
                title: "Content request processed",
                message: `${event.newItems ?? 0} new item(s) added`,
                severity: "success",
                timestamp: ts,
                type: "movie"
            };

        case "riven.media-item.download.error":
            return {
                title: event.title ?? "Download failed",
                message: event.error ?? "An error occurred",
                severity: "error",
                timestamp: ts,
                type: "movie"
            };

        case "riven.media-item.scrape.error":
            return {
                title: event.title ?? "Scrape failed",
                message: event.error ?? "An error occurred",
                severity: "error",
                timestamp: ts,
                type: "movie"
            };

        case "riven.media-item.scrape.error.no-new-streams":
            return {
                title: event.title ?? "No streams found",
                message: "No new streams found",
                severity: "warning",
                timestamp: ts,
                type: mapItemType(event.itemType)
            };

        default:
            return null;
    }
}

export class NotificationStore {
    #notifications = $state<Notification[]>([]);
    #connectionStatus = $state<"connecting" | "connected" | "disconnected" | "error">(
        "disconnected"
    );
    #unsubscribe: (() => void) | null = null;
    #eventListeners = new SvelteSet<(event: RivenNotificationPayload) => void>();
    #connectionRefs = 0;
    #reconnectAttempts = 0;
    #maxReconnectAttempts = 3;

    onNotificationAdded: ((notification: Notification) => void) | null = null;

    get notifications() {
        return this.#notifications;
    }

    get unreadCount() {
        return this.#notifications.filter((n) => !n.read).length;
    }

    get connectionStatus() {
        return this.#connectionStatus;
    }

    add(notification: Omit<Notification, "id" | "read">) {
        const newNotification: Notification = {
            ...notification,
            id: crypto.randomUUID(),
            read: false
        };
        this.#notifications = [newNotification, ...this.#notifications];
        this.onNotificationAdded?.(newNotification);
    }

    markAsRead(id: string) {
        const notification = this.#notifications.find((n) => n.id === id);
        if (notification) {
            notification.read = true;
        }
    }

    markAllAsRead() {
        this.#notifications.forEach((n) => (n.read = true));
    }

    clear() {
        this.#notifications = [];
    }

    remove(id: string) {
        this.#notifications = this.#notifications.filter((n) => n.id !== id);
    }

    #disconnectTransport() {
        this.#connectionStatus = "disconnected";
        if (this.#unsubscribe) {
            this.#unsubscribe();
            this.#unsubscribe = null;
        }
    }

    #connectTransport() {
        if (this.#unsubscribe) {
            return;
        }

        this.#connectionStatus = "connecting";

        this.#unsubscribe = gqlSubscribeClient<{ notifications: RivenNotificationPayload }>(
            NOTIFICATIONS_SUBSCRIPTION,
            undefined,
            {
                onData: (payload) => {
                    this.#connectionStatus = "connected";
                    this.#reconnectAttempts = 0;
                    const event = payload.notifications;
                    this.#eventListeners.forEach((cb) => cb(event));
                    const mapped = rivenNotificationToNotification(event);
                    if (mapped) {
                        this.add(mapped);
                    }
                },
                onError: (error) => {
                    this.#reconnectAttempts += 1;

                    if (this.#reconnectAttempts >= this.#maxReconnectAttempts) {
                        logger.error("Notification subscription error:", error);
                        this.#connectionStatus = "error";
                        return;
                    }

                    this.#connectionStatus = "connecting";
                    this.#disconnectTransport();
                    const reconnectDelayMs = 5000 * this.#reconnectAttempts;
                    setTimeout(() => {
                        if (this.#connectionRefs > 0) {
                            this.#connectTransport();
                        }
                    }, reconnectDelayMs);
                }
            }
        );
    }

    connect() {
        this.#connectionRefs += 1;
        this.#connectTransport();
    }

    subscribe(callback: (event: RivenNotificationPayload) => void) {
        this.#eventListeners.add(callback);
        return () => {
            this.#eventListeners.delete(callback);
        };
    }

    disconnect() {
        this.#connectionRefs = Math.max(0, this.#connectionRefs - 1);

        if (this.#connectionRefs > 0) {
            return;
        }

        this.#disconnectTransport();
    }

    reconnect() {
        this.#disconnectTransport();
        if (this.#connectionRefs === 0) {
            this.#connectionRefs = 1;
        }
        this.#connectTransport();
    }
}

export const notificationStore = new NotificationStore();
