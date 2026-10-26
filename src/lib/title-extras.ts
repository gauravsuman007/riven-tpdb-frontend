/*
Title extras: billing order, wide art and IMDb rating.

Hand-maintained against `routers/secure/tpdb.py` (`TitleExtras`), for the
same reason as `collections.ts`: `providers/riven.ts` is generated from an
OpenAPI spec that needs a running backend. The data comes from TMDB and IMDb's
own dataset; see `program/apis/title_extras.py` in the backend.
*/

import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("title-extras");

export interface TitleExtras {
    kind: string | null;
    tmdb_id: number | null;
    imdb_id: string | null;
    imdb_rating: number | null;
    imdb_votes: number | null;
    /** The cast in billing order; empty when unknown. */
    cast_order: string[];
    /** Source URL of a 16:9 image. Draw it through `wideSrc`, never directly. */
    wide: string | null;
}

interface FetchOptions {
    baseUrl: string;
    apiKey: string;
    fetch: typeof globalThis.fetch;
}

/**
 * One title's extras. The backend works them out on a miss (TMDB, ~1s), so
 * the call is bounded: a page that waits longer than `timeoutMs` renders
 * without them rather than late. Library titles are pre-computed and cached.
 */
export async function getTitleExtras(
    uuid: string,
    { baseUrl, apiKey, fetch }: FetchOptions,
    timeoutMs = 3000
): Promise<TitleExtras | null> {
    try {
        const response = await fetch(`${baseUrl}/api/v1/tpdb/extras/${encodeURIComponent(uuid)}`, {
            headers: { "x-api-key": apiKey },
            signal: AbortSignal.timeout(timeoutMs)
        });

        return response.ok ? ((await response.json()) as TitleExtras) : null;
    } catch (err) {
        logger.debug(`extras for ${uuid} unavailable: ${err}`);
        return null;
    }
}

/**
 * Extras already worked out for several titles. Cache-only on the backend,
 * which fills the misses in the background for the next visit.
 */
export async function getTitleExtrasBatch(
    uuids: string[],
    { baseUrl, apiKey, fetch }: FetchOptions
): Promise<Record<string, TitleExtras>> {
    const ids = [...new Set(uuids.filter(Boolean))].slice(0, 50);

    if (!ids.length) return {};

    const query = new URLSearchParams();
    for (const id of ids) query.append("ids", id);

    try {
        const response = await fetch(`${baseUrl}/api/v1/tpdb/extras?${query}`, {
            headers: { "x-api-key": apiKey },
            signal: AbortSignal.timeout(2000)
        });

        return response.ok ? ((await response.json()) as Record<string, TitleExtras>) : {};
    } catch (err) {
        logger.debug(`batch extras unavailable: ${err}`);
        return {};
    }
}

const WIDE_HOSTS = new Set(["cdn.theporndb.net", "thumb.theporndb.net", "image.tmdb.org"]);

/** Where the page loads a wide image from: this app, which proxies the backend's cache. */
export function wideSrc(url: string | null | undefined): string | null {
    if (!url) return null;

    try {
        const parsed = new URL(url);

        if (parsed.protocol !== "https:" || !WIDE_HOSTS.has(parsed.hostname)) return null;
    } catch {
        return null;
    }

    return `/art/wide?u=${encodeURIComponent(url)}`;
}

/** "1.2k" for a vote count, which is how rating sites print them. */
export function votes(count: number): string {
    return count >= 1000 ? `${(count / 1000).toFixed(count >= 10_000 ? 0 : 1)}k` : String(count);
}
