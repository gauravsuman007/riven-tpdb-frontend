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
