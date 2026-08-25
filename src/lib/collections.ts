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
    /** Source-native identity, for catalogues that need no TPDB lookup. */
    external_source: string | null;
    external_id: string | null;
    /** Position in a ranked listing; null for unordered collections. */
    rank: number | null;
    /** Audience score on the source's own scale (Adult Empire rates out of 5). */
    rating: number | null;
    duration_minutes: number | null;
    match_state: "pending" | "matched" | "unmatched" | "skipped" | "self_sourced";
    poster_path: string | null;
    requested: boolean;
    /** Requestable as it stands — has either a TPDB id or a source id. */
    actionable: boolean;
    media_item_id: number | null;
    state: string | null;
}

export interface BrochureShelf {
    key: string;
    name: string;
    description: string | null;
    refreshed_at: string | null;
    total: number;
    entries: CollectionEntry[];
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

/**
 * Every brochure shelf with its top entries, in one request.
 *
 * Served whole rather than a request per row: four shelves would otherwise be
 * four round trips before the page paints.
 */
export async function getBrochure(options: FetchOptions, perShelf = 24): Promise<BrochureShelf[]> {
    return (
        (await get<BrochureShelf[]>(
            `/collections/brochure/shelves?per_shelf=${perShelf}`,
            options
        )) ?? []
    );
}

export async function getEntry(
    entryId: number,
    options: FetchOptions
): Promise<CollectionEntry | null> {
    return get<CollectionEntry>(`/collections/entries/${entryId}`, options);
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

export interface AvnYear {
    year: number;
    /** Null while the ceremony's collection has not been built yet. */
    key: string | null;
    name: string;
    status: "ready" | "fetching";
    total: number;
    matched: number;
    requested: number;
    entries: CollectionEntry[];
}

export interface AvnOverview {
    enabled: boolean;
    years: AvnYear[];
    /** Entry counts per match state across every year. */
    progress: Record<string, number>;
}

/**
 * Every AVN ceremony year, newest first.
 *
 * Years the corpus has not reached yet come back with `status: "fetching"` and
 * no entries, rather than being omitted — a page that grows downwards while a
 * sync runs reads as breakage, not as progress.
 */
export async function getAvnOverview(options: FetchOptions, perYear = 18): Promise<AvnOverview> {
    return (
        (await get<AvnOverview>(`/collections/avn/overview?per_year=${perYear}`, options)) ?? {
            enabled: false,
            years: [],
            progress: {}
        }
    );
}

async function send<T>(
    path: string,
    method: "POST" | "DELETE",
    { baseUrl, apiKey, fetch }: FetchOptions,
    body?: unknown
): Promise<{ ok: boolean; message: string; data: T | null }> {
    try {
        const response = await fetch(`${baseUrl}/api/v1${path}`, {
            method,
            headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
            body: body === undefined ? undefined : JSON.stringify(body)
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            return {
                ok: false,
                message: payload.detail ?? `Request failed (${response.status})`,
                data: null
            };
        }

        return { ok: true, message: payload.message ?? "Done", data: payload as T };
    } catch (err) {
        logger.error(`${method} ${path} threw: ${err}`);
        return { ok: false, message: "Could not reach the backend", data: null };
    }
}

/**
 * Turn the AVN corpus job on or off.
 *
 * This both saves the setting and re-registers the scheduled job, so the switch
 * on the AVN page and the one in Settings are the same switch.
 */
export async function setAvnEnabled(enabled: boolean, options: FetchOptions) {
    return send<{ enabled: boolean; message: string }>(
        `/collections/avn/enable?enabled=${enabled}`,
        "POST",
        options
    );
}

export interface BrochureStatus {
    enabled: boolean;
    /** Titles mirrored so far — tells "switched off" from "not synced yet". */
    total: number;
}

export async function getBrochureStatus(options: FetchOptions): Promise<BrochureStatus> {
    return (
        (await get<BrochureStatus>("/collections/brochure/status", options)) ?? {
            enabled: false,
            total: 0
        }
    );
}

/** Same two-effect switch as {@link setAvnEnabled}: saves *and* reschedules. */
export async function setBrochureEnabled(enabled: boolean, options: FetchOptions) {
    return send<{ enabled: boolean; message: string }>(
        `/collections/brochure/enable?enabled=${enabled}`,
        "POST",
        options
    );
}

export async function createCollection(name: string, options: FetchOptions, description?: string) {
    return send<CollectionSummary>("/collections", "POST", options, { name, description });
}

export interface AddToCollectionBody {
    tpdb_id?: string | null;
    tpdb_kind?: string;
    media_item_id?: number | null;
    entry_id?: number | null;
    new_collection_name?: string | null;
}

/**
 * Add one title to a user collection. Pass the key `"new"` together with
 * `new_collection_name` to create the collection and add in one round trip.
 *
 * Adding never requests the title — a collection is what you are interested in,
 * the library is what you own.
 */
export async function addToCollection(
    key: string,
    body: AddToCollectionBody,
    options: FetchOptions
) {
    return send<CollectionEntry>(
        `/collections/${encodeURIComponent(key)}/items`,
        "POST",
        options,
        body
    );
}

export async function removeFromCollection(key: string, entryId: number, options: FetchOptions) {
    return send<{ message: string }>(
        `/collections/${encodeURIComponent(key)}/items/${entryId}`,
        "DELETE",
        options
    );
}

export async function deleteCollection(key: string, options: FetchOptions) {
    return send<{ message: string }>(`/collections/${encodeURIComponent(key)}`, "DELETE", options);
}
