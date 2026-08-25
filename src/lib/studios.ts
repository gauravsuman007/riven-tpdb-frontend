/*
Studios client.

Hand-maintained against `routers/secure/studios.py`, for the same reason as
`collections.ts`: `providers/riven.ts` is generated from the backend's OpenAPI
spec and regenerating it needs a running backend.

Two different kinds of call live here, and the difference matters to anything
reading this. Listing studios is a database read and is fast. Opening one
reads the storefront live, twice, at its one-request-a-second courtesy delay --
so a studio page takes a couple of seconds and there is no way to make it
faster without lying about how current the ranking is.
*/

import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("studios");

export interface Studio {
    id: number;
    ae_id: string;
    name: string;
    slug: string | null;
    title_count: number | null;
    description: string | null;
    logo_path: string | null;
    poster_path: string | null;
    tpdb_site_id: string | null;
    saved: boolean;
}

export interface StudioTitle {
    rank: number;
    product_id: string;
    title: string;
    poster: string | null;
}

export interface StudioRow {
    key: string;
    name: string;
    description: string;
    titles: StudioTitle[];
}

export interface StudioDetail extends Studio {
    rows: StudioRow[];
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
 * Studios, biggest catalogue first.
 *
 * Returns [] rather than throwing: the studios section is an addition to the
 * brochure, and a studios outage must not take the shelves down with it.
 */
export async function listStudios(
    options: FetchOptions,
    params: { saved?: boolean; search?: string; limit?: number } = {}
): Promise<Studio[]> {
    const query = new URLSearchParams();

    if (params.saved !== undefined) query.set("saved", String(params.saved));
    if (params.search) query.set("search", params.search);
    if (params.limit) query.set("limit", String(params.limit));

    const suffix = query.size ? `?${query}` : "";
    return (await get<Studio[]>(`/studios${suffix}`, options)) ?? [];
}

export async function getStudio(
    studioId: number,
    options: FetchOptions,
    perRow = 12
): Promise<StudioDetail | null> {
    return get<StudioDetail>(`/studios/${studioId}?per_row=${perRow}`, options);
}

export async function setStudioSaved(
    studioId: number,
    saved: boolean,
    { baseUrl, apiKey, fetch }: FetchOptions
): Promise<{ ok: boolean; message: string }> {
    try {
        const response = await fetch(`${baseUrl}/api/v1/studios/${studioId}/save`, {
            method: saved ? "POST" : "DELETE",
            headers: { "x-api-key": apiKey }
        });

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            return { ok: false, message: body.detail ?? `Failed (${response.status})` };
        }

        return { ok: true, message: saved ? "Studio added" : "Studio removed" };
    } catch (err) {
        logger.error(`save studio ${studioId} threw: ${err}`);
        return { ok: false, message: "Could not reach the backend" };
    }
}

/**
 * Turn a studio listing row into a brochure entry and return its id.
 *
 * A studio's rows are read live and have no database row of their own until
 * someone opens one. This is that promotion, and it is what lets a studio
 * title land on the same detail page as a bestseller rather than needing a
 * second one.
 */
export async function promoteTitle(
    productId: string,
    { baseUrl, apiKey, fetch }: FetchOptions
): Promise<{ ok: boolean; entryId?: number; message: string }> {
    try {
        const response = await fetch(
            `${baseUrl}/api/v1/studios/titles/${encodeURIComponent(productId)}`,
            { method: "POST", headers: { "x-api-key": apiKey } }
        );

        const body = await response.json().catch(() => ({}));

        if (!response.ok) {
            return { ok: false, message: body.detail ?? `Failed (${response.status})` };
        }

        return { ok: true, entryId: body.entry_id, message: body.message ?? "Added" };
    } catch (err) {
        logger.error(`promote title ${productId} threw: ${err}`);
        return { ok: false, message: "Could not reach the backend" };
    }
}
