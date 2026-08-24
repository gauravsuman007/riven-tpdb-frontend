/*
Collections client.

These endpoints are not in `providers/riven.ts` because that file is generated
from the backend's OpenAPI spec (`pnpx openapi-typescript`), which needs a
running backend. Regenerate it and these calls can move over; until then the
shapes below are maintained by hand against `routers/secure/collections.py`.
*/

import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("collections");

export interface CollectionSummary {
    id: number;
    key: string;
    source: string;
    name: string;
    description: string | null;
    year: number | null;
    poster_path: string | null;
    refreshed_at: string | null;
    /** Every entry in the collection, requested or not. */
    total: number;
    winners: number;
    /** Entries resolved to a TPDB title, so they can be requested. */
    matched: number;
    /** Entries that are actually in the library. */
    requested: number;
}

export interface CollectionEntry {
    id: number;
    title: string;
    studio: string | null;
    performers: string[] | null;
    category: string | null;
    year: number | null;
    winner: boolean;
    tpdb_id: string | null;
    tpdb_kind: string | null;
    match_state: "pending" | "matched" | "unmatched" | "skipped";
    poster_path: string | null;
    requested: boolean;
    media_item_id: number | null;
    state: string | null;
}

export interface CollectionDetail extends CollectionSummary {
    entries: CollectionEntry[];
}

interface FetchOptions {
    baseUrl: string;
    apiKey: string;
    fetch: typeof globalThis.fetch;
}

async function get<T>(path: string, { baseUrl, apiKey, fetch }: FetchOptions): Promise<T | null> {
    try {
        const response = await fetch(`${baseUrl}/api/v1${path}`, {
            headers: { "x-api-key": apiKey }
        });

        if (!response.ok) {
            logger.error(`GET ${path} failed: ${response.status}`);
            return null;
        }

        return (await response.json()) as T;
    } catch (err) {
        logger.error(`GET ${path} threw: ${err}`);
        return null;
    }
}

/**
 * All collections, newest year first.
 *
 * Returns [] rather than throwing when the backend is unreachable: the shelf is
 * an addition to the library page, and a collections outage should not take the
 * whole library down with it.
 */
export async function listCollections(
    options: FetchOptions,
    source?: string
): Promise<CollectionSummary[]> {
    const query = source ? `?source=${encodeURIComponent(source)}` : "";
    return (await get<CollectionSummary[]>(`/collections${query}`, options)) ?? [];
}

export async function getCollection(
    key: string,
    options: FetchOptions,
    params: { winnersOnly?: boolean; matchedOnly?: boolean; limit?: number } = {}
): Promise<CollectionDetail | null> {
    const query = new URLSearchParams();

    if (params.winnersOnly) query.set("winners_only", "true");
    if (params.matchedOnly) query.set("matched_only", "true");
    if (params.limit) query.set("limit", String(params.limit));

    const suffix = query.size ? `?${query}` : "";
    return get<CollectionDetail>(`/collections/${encodeURIComponent(key)}${suffix}`, options);
}

export async function requestEntry(
    entryId: number,
    { baseUrl, apiKey, fetch }: FetchOptions
): Promise<{ ok: boolean; message: string }> {
    try {
        const response = await fetch(`${baseUrl}/api/v1/collections/entries/${entryId}/request`, {
            method: "POST",
            headers: { "x-api-key": apiKey }
        });

        const body = await response.json().catch(() => ({}));

        if (!response.ok) {
            return { ok: false, message: body.detail ?? `Request failed (${response.status})` };
        }

        return { ok: true, message: body.message ?? "Requested" };
    } catch (err) {
        logger.error(`request entry ${entryId} threw: ${err}`);
        return { ok: false, message: "Could not reach the backend" };
    }
}

/** Entries grouped by award category, preserving the order the API returned. */
export function groupByCategory(entries: CollectionEntry[]): [string, CollectionEntry[]][] {
    const groups = new Map<string, CollectionEntry[]>();

    for (const entry of entries) {
        const key = entry.category ?? "Other";
        const group = groups.get(key);

        if (group) {
            group.push(entry);
        } else {
            groups.set(key, [entry]);
        }
    }

    return [...groups.entries()];
}
