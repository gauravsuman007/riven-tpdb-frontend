import { source } from "sveltekit-sse";
import { gqlClient } from "$lib/graphql-client";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("logs");

export type LogEntry = {
    timestamp?: string | null;
    level?: string | null;
    message?: string | null;
    target?: string | null;
};

const HISTORICAL_LOGS_QUERY = `
    query GetLogs($limit: Int, $level: String) {
        logs(limit: $limit, level: $level) {
            timestamp
            level
            message
            target
        }
    }
`;

export class LogStore {
    #logs = $state<LogEntry[]>([]);
    #historicalLogs = $state<LogEntry[]>([]);
    #isLoadingHistorical = $state<boolean>(false);
    #activeTab = $state<"live" | "historical">("live");
    #error = $state<string | null>(null);
    #historicalError = $state<string | null>(null);
    #connectionStatus = $state<"connecting" | "connected" | "disconnected" | "error">(
        "disconnected"
    );
    #connection: ReturnType<typeof source> | null = null;
    #unsubscribe: (() => void) | null = null;

    #reconnectAttempts = $state<number>(0);
    #maxReconnectAttempts = 5;
    #hasConnected = $state<boolean>(false);

    get reconnectAttempts() {
        return this.#reconnectAttempts;
    }

    get maxReconnectAttempts() {
        return this.#maxReconnectAttempts;
    }
    get hasConnected() {
        return this.#hasConnected;
    }

    get logs() {
        return this.#logs;
    }

    get historicalLogs() {
        return this.#historicalLogs;
    }

    get isLoadingHistorical() {
        return this.#isLoadingHistorical;
    }

    get activeTab() {
        return this.#activeTab;
    }

    get error() {
        return this.#error;
    }

    get historicalError() {
        return this.#historicalError;
    }

    get connectionStatus() {
        return this.#connectionStatus;
    }

    async fetchHistoricalLogs(limit = 500, level?: string) {
        try {
            this.#isLoadingHistorical = true;
            this.#historicalError = null;

            const data = await gqlClient<{ logs: LogEntry[] }>(HISTORICAL_LOGS_QUERY, {
                limit,
                level: level ?? null
            });

            this.#historicalLogs = data.logs;
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Unknown error";
            logger.error("Failed to fetch historical logs:", e);
            this.#historicalError = `Failed to fetch logs: ${message}`;
        } finally {
            this.#isLoadingHistorical = false;
        }
    }

    connect() {
        if (this.#connection) {
            return;
        }

        this.#connectionStatus = "connecting";
        this.#error = null;
        this.#hasConnected = false;

        this.#connection = source("/api/logs", {
            open: () => {
                this.#connectionStatus = "connected";
                this.#error = null;
                this.#reconnectAttempts = 0;
                this.#hasConnected = true;
            },
            close: ({ connect }) => {
                if (this.#connectionStatus !== "disconnected") {
                    this.#reconnectAttempts += 1;
                    if (this.#reconnectAttempts >= this.#maxReconnectAttempts) {
                        this.#connectionStatus = "error";
                        this.#error = "Log stream disconnected";
                        return;
                    }
                    this.#connectionStatus = "connecting";
                    setTimeout(() => {
                        if (this.#connectionStatus !== "disconnected") connect();
                    }, 1000);
                }
            },
            error: (streamError) => {
                logger.error("Log stream error:", streamError);
                this.#error = "Connection error";
            }
        });

        const logValue = this.#connection.select("log").transform((raw) => {
            if (!raw?.trim()) {
                return null;
            }
            try {
                return JSON.parse(raw) as LogEntry;
            } catch (parseError) {
                logger.warn("Failed to parse log entry:", raw, parseError);
                return null;
            }
        });

        this.#unsubscribe = logValue.subscribe((value) => {
            if (value) {
                this.#logs.push(value);
                this.#error = null;
            }
        });
    }

    disconnect() {
        this.#connectionStatus = "disconnected";
        this.#hasConnected = false;
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

    setActiveTab(tab: "live" | "historical") {
        this.#activeTab = tab;
        if (tab === "historical" && this.#historicalLogs.length === 0) {
            this.fetchHistoricalLogs();
        }
    }
}

export const logStore = new LogStore();
