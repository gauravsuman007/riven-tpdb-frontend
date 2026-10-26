/**
 * IMDb ratings for the cards on a page.
 *
 * A grid of forty cards asks for forty ratings at once; they are collected for
 * a moment and sent as one request (the backend's batch takes 50). The backend
 * answers from its cache and works the rest out in the background, so a title
 * with no answer yet is asked again once, a few seconds later.
 */

import { SvelteMap } from "svelte/reactivity";

export interface ImdbRating {
    rating: number;
    votes: number;
}

const ratings = new SvelteMap<string, ImdbRating>();
const asked = new Map<string, number>();
const queue = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;

const BATCH = 50;
const RETRY_MS = 8000;
const MAX_ASKS = 2;

async function flush() {
    timer = undefined;

    const ids = [...queue];
    queue.clear();

    for (let start = 0; start < ids.length; start += BATCH) {
        const chunk = ids.slice(start, start + BATCH);
        const query = new URLSearchParams();
        for (const id of chunk) query.append("ids", id);

        try {
            const response = await fetch(`/api/tpdb/extras?${query}`);
            if (!response.ok) continue;

            const found = (await response.json()) as Record<string, ImdbRating>;
            for (const [id, value] of Object.entries(found)) ratings.set(id, value);

            for (const id of chunk) {
                if (!found[id] && (asked.get(id) ?? 0) < MAX_ASKS)
                    setTimeout(() => request(id), RETRY_MS);
            }
        } catch {
            // A card without a rating is fine; the next page view asks again.
        }
    }
}

function request(id: string) {
    if (ratings.has(id) || queue.has(id)) return;
    if ((asked.get(id) ?? 0) >= MAX_ASKS) return;

    asked.set(id, (asked.get(id) ?? 0) + 1);
    queue.add(id);
    timer ??= setTimeout(flush, 60);
}

/** The rating for a TPDB uuid, or null until (unless) the backend has one. */
export function imdbRating(uuid: string | null | undefined): ImdbRating | null {
    if (!uuid) return null;

    const known = ratings.get(uuid);
    if (known) return known;

    // Called from a $derived, so this must not write reactive state itself.
    if (typeof window !== "undefined") queueMicrotask(() => request(uuid));

    return null;
}
