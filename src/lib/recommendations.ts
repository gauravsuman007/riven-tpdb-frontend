/*
Recommendations client.

Hand-maintained against `routers/secure/explore.py` for the same reason as
`collections.ts`: `providers/riven.ts` is generated from the backend's OpenAPI
spec, which needs a running backend to regenerate.

Every rail comes back in one request. A request per rail is what made the old
discovery page feel slow -- rows arriving one at a time reflow the page under
whoever is reading it.
*/

import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("recommendations");

export interface Recommendation {
    key: string;
    title: string;
    kind: "movie" | "scene";
    score: number;
    /**
     * The `CollectionEntry` behind this title. A rail item is an ordinary
     * collection entry, so requesting it goes through the same endpoint a
     * brochure or award row does. Null on scene results, which have no entry
     * and therefore no request path yet.
     */
    entry_id: number | null;
    collection_key: string | null;
    external_source: string | null;
    external_id: string | null;
    tpdb_id: string | null;
    stashdb_id: string | null;
    adultempire_id: string | null;
    studio: string | null;
    year: number | null;
    rating: number | null;
    duration_minutes: number | null;
    performers: string[];
    poster_path: string | null;
    requested: boolean;
    /** Score components, so a title can say why it is here. */
    signals: Record<string, number>;
    reasons: string[];
}

export interface Rail {
    key: string;
    title: string;
    /** Why this row exists, in the intent's own words. */
    reason: string;
    kind: "movies" | "scenes";
    /**
     * The intent this row asks, or null for the unfiltered baseline row.
     * Carried by the backend so a client can re-rank one rail; splitting the
     * key on a hyphen would work only until an intent name contains one.
     */
    intent: string | null;
    items: Recommendation[];
}

export interface ExploreRows {
    rails: Rail[];
    /**
     * Why a rail is missing, when one is. Shown rather than swallowed: "the
     * scene engine needs a StashDB key" is actionable, a silently absent row
     * is not.
     */
    notices: string[];
}

export interface Intent {
    name: string;
    label: string;
    description: string;
    engines: string[];
    /** How many of this intent's terms StashDB can actually filter on. */
    resolvable_tags: number;
}

export interface VocabularyStatus {
    ingested: boolean;
    tags: number;
    categories: Record<string, number>;
    scene_engine_available: boolean;
}

export interface CategoryIndexStatus {
    built: boolean;
    /** A crawl is minutes of rate-limited requests; this says one is in flight. */
    running: boolean;
    titles: number;
    categories: string[];
    fetched_at: number | null;
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
 * Every recommendation rail, in one request.
 *
 * Returns an empty set rather than throwing: Explore also carries the awards
 * and brochure tabs, and a ranking outage should not take those down with it.
 */
export async function getRows(options: FetchOptions, perRail = 20): Promise<ExploreRows> {
    return (
        (await get<ExploreRows>(`/explore/rows?per_rail=${perRail}`, options)) ?? {
            rails: [],
            notices: ["Could not reach the recommendation engine."]
        }
    );
}

/** How a rail may be ordered. */
export type RailSort = "score" | "rating";

export interface RailQuery {
    intent: string | null;
    engine: "movies" | "scenes";
    sort: RailSort;
    /** Audience stars out of five. 0 means "no minimum". */
    minRating: number;
    limit?: number;
}

/**
 * Re-rank one rail under its own rating filter and sort.
 *
 * Deliberately a fresh ranking of the whole corpus rather than a filter over
 * the rail already on screen. Twenty titles narrowed to the three that happen
 * to have four stars is not the same answer as the catalogue's best three
 * four-star titles for that intent, and it is the wrong one.
 *
 * Returns null on failure so the caller can leave the rail as it was and say
 * so, rather than blanking a row that was fine a moment ago.
 */
export async function getRail(
    options: FetchOptions,
    { intent, engine, sort, minRating, limit = 20 }: RailQuery
): Promise<Recommendation[] | null> {
    const query = new URLSearchParams({
        engine,
        sort,
        limit: String(limit)
    });

    if (intent) {
        query.set("intent", intent);
    }

    // Omitted rather than sent as 0: the backend treats a zero minimum as no
    // filter anyway, and not sending it keeps the request honest about what
    // was actually asked for.
    if (minRating > 0) {
        query.set("min_rating", String(minRating));
    }

    return get<Recommendation[]>(`/explore/recommendations?${query}`, options);
}

export async function getCategoryIndex(options: FetchOptions): Promise<CategoryIndexStatus | null> {
    return get<CategoryIndexStatus>("/explore/categories", options);
}

/**
 * Build the movie corpus's genre index from Adult Empire's categories.
 *
 * Returns as soon as the crawl has been started, not when it finishes: an
 * Adult Empire product page carries no genre at all, so this reads the
 * category listings instead, which is a few minutes of one-request-per-second
 * courtesy crawling. Poll `getCategoryIndex` for progress.
 */
export async function syncCategoryIndex({
    baseUrl,
    apiKey,
    fetch
}: FetchOptions): Promise<{ ok: boolean; message: string }> {
    try {
        const response = await fetch(`${baseUrl}/api/v1/explore/categories/sync`, {
            method: "POST",
            headers: { "x-api-key": apiKey }
        });

        const body = await response.json().catch(() => ({}));

        if (!response.ok) {
            return { ok: false, message: body.detail ?? `Failed (${response.status})` };
        }

        return {
            ok: true,
            message: body.running
                ? "Already indexing; leave it running."
                : "Indexing Adult Empire's categories. This takes a few minutes — reload to see progress."
        };
    } catch (err) {
        logger.error(`category sync threw: ${err}`);
        return { ok: false, message: "Could not reach the backend" };
    }
}

export async function listIntents(options: FetchOptions): Promise<Intent[]> {
    return (await get<Intent[]>("/explore/intents", options)) ?? [];
}

export async function getVocabulary(options: FetchOptions): Promise<VocabularyStatus | null> {
    return get<VocabularyStatus>("/explore/vocabulary", options);
}

/**
 * Read StashDB's tag graph into the local facet vocabulary.
 *
 * About thirty calls, and the graph barely moves, so this is an occasional
 * button rather than a scheduled job.
 */
export async function ingestVocabulary({
    baseUrl,
    apiKey,
    fetch
}: FetchOptions): Promise<{ ok: boolean; message: string }> {
    try {
        const response = await fetch(`${baseUrl}/api/v1/explore/vocabulary/ingest`, {
            method: "POST",
            headers: { "x-api-key": apiKey }
        });

        const body = await response.json().catch(() => ({}));

        if (!response.ok) {
            return { ok: false, message: body.detail ?? `Failed (${response.status})` };
        }

        return {
            ok: true,
            message: body.ingested
                ? `Vocabulary refreshed: ${body.tags} tags.`
                : "StashDB returned no tags. Check the API key in Settings."
        };
    } catch (err) {
        logger.error(`vocabulary ingest threw: ${err}`);
        return { ok: false, message: "Could not reach the backend" };
    }
}
