/**
 * Fetching for "Up next": the library from the backend and the viewer's
 * history from this app's database. The choosing is `$lib/utils/up-next`.
 */

import { getRecentProgress, TICKS_PER_SECOND } from "./playback-progress";
import { upNext, type LibraryItem, type UpNextCard, type Watched } from "$lib/utils/up-next";

export type { UpNextCard } from "$lib/utils/up-next";

/** The library, newest first, as the backend lists it. */
async function libraryItems(
    backendUrl: string,
    apiKey: string,
    fetch: typeof globalThis.fetch,
    limit: number
): Promise<LibraryItem[]> {
    const url = new URL("/api/v1/items", backendUrl);

    url.searchParams.set("sort", "date_desc");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("page", "1");
    url.searchParams.append("type", "movie");
    url.searchParams.append("type", "show");
    url.searchParams.append("states", "All");

    try {
        const response = await fetch(url.toString(), { headers: { "x-api-key": apiKey } });

        if (!response.ok) return [];

        const data = (await response.json()) as { items?: LibraryItem[] };

        return Array.isArray(data.items) ? data.items : [];
    } catch {
        return [];
    }
}

/**
 * The viewer's cards. Never throws: a backend that cannot be read is an
 * empty strip, and every caller falls back to what it drew before.
 */
export async function loadUpNext(
    userId: string,
    backend: { backendUrl: string; apiKey: string; fetch: typeof globalThis.fetch },
    options: { now?: number; limit?: number } = {}
): Promise<UpNextCard[]> {
    if (!userId) return [];

    const library = await libraryItems(backend.backendUrl, backend.apiKey, backend.fetch, 200);
    const watched: Watched[] = getRecentProgress(userId, 50).map((row) => ({
        itemId: row.itemId,
        positionSeconds: row.positionTicks / TICKS_PER_SECOND,
        durationSeconds: row.runtimeTicks ? row.runtimeTicks / TICKS_PER_SECOND : null,
        played: row.played,
        updatedAt: row.updatedAt.toISOString()
    }));

    return upNext(library, watched, options);
}
