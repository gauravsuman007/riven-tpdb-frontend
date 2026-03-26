import { source } from "sveltekit-sse";
import { createScopedLogger } from "$lib/logger";

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

// Shape of RivenEvent as serialised by the Rust backend.
type RivenEventPayload = {
    type: string;
    // MediaItemDownloadSuccess fields
    title?: string;
    full_title?: string;
    item_type?: string;
    year?: number;
    imdb_id?: string;
    tmdb_id?: string;
    tvdb_id?: string;
    duration_seconds?: number;
    // ScrapeSuccess / IndexSuccess fields
    id?: number;
    stream_count?: number;
    // ItemRequestCreateSuccess
    count?: number;
    new_items?: number;
    // Error fields
    error?: string;
};

function mapItemType(raw?: string): "movie" | "show" | "season" | "episode" {
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

function rivenEventToNotification(event: RivenEventPayload): Omit<Notification, "id" | "read"> | null {
    const ts = new Date().toISOString();

    switch (event.type) {
        case "riven.media-item.download.success":
            return {
                title: event.full_title ?? event.title ?? "Unknown",
                message: `Download complete${event.year ? ` (${event.year})` : ""}`,
                severity: "success",
                timestamp: ts,
                type: mapItemType(event.item_type),
                year: event.year,
                duration: event.duration_seconds ? Math.round(event.duration_seconds / 60) : undefined,
                imdb_id: event.imdb_id
            };

        case "riven.media-item.scrape.success":
            return {
                title: event.title ?? "Unknown",
                message: `Found ${event.stream_count ?? 0} stream(s)`,
                severity: "success",
                timestamp: ts,
                type: mapItemType(event.item_type)
            };

        case "riven.media-item.index.success":
            return {
                title: event.title ?? "Unknown",
                message: "Indexed successfully",
                severity: "success",
                timestamp: ts,
                type: mapItemType(event.item_type)
            };

        case "riven.item-request.create.success":
            return {
                title: "Content request processed",
                message: `${event.new_items ?? 0} new item(s) added`,
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
                type: mapItemType(event.item_type)
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
    #connection: ReturnType<typeof source> | null = null;
    #unsubscribe: (() => void) | null = null;
    #eventListeners = new Set<(event: RivenEventPayload) => void>();

    // Callback for when a new notification is added (for toast display)
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

    connect() {
        if (this.#connection) {
            return;
        }

        this.#connectionStatus = "connecting";

        this.#connection = source("/api/notifications", {
            open: () => {
                this.#connectionStatus = "connected";
                logger.info("Notification stream connected");
            },
            close: ({ connect }) => {
                if (this.#connectionStatus !== "disconnected") {
                    this.#connectionStatus = "error";
                    logger.info("Notification stream closed, reconnecting...");
                    setTimeout(() => {
                        if (this.#connectionStatus !== "disconnected") {
                            connect();
                        }
                    }, 1000);
                }
            },
            error: (error) => {
                logger.error("Notification stream error:", error);
                this.#connectionStatus = "error";
            }
        });

        const notificationValue = this.#connection
            .select("notification")
            .json<RivenEventPayload>(({ error, previous }) => {
                if (error) {
                    logger.warn("Failed to parse notification:", error);
                }
                return previous;
            });

        this.#unsubscribe = notificationValue.subscribe((value) => {
            if (value) {
                // eslint-disable-next-line no-console
                console.debug(`[NotificationStore] Received event: ${value.type}`, value);

                // Notify listeners
                this.#eventListeners.forEach((cb) => cb(value));

                const mapped = rivenEventToNotification(value);
                if (mapped) {
                    this.add(mapped);
                }
            }
        });
    }

    subscribe(callback: (event: RivenEventPayload) => void) {
        this.#eventListeners.add(callback);
        return () => {
            this.#eventListeners.delete(callback);
        };
    }

    disconnect() {
        this.#connectionStatus = "disconnected";
        if (this.#unsubscribe) {
            this.#unsubscribe();
            this.#unsubscribe = null;
        }
        if (this.#connection) {
            this.#connection.close();
            this.#connection = null;
        }
    }

    reconnect() {
        this.disconnect();
        this.connect();
    }
}

export const notificationStore = new NotificationStore();
