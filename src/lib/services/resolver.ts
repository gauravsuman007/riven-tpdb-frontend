import { createScopedLogger } from "$lib/logger";
import { gql } from "$lib/graphql-client";
import {
    fetchAnilistMappings,
    fetchTmdbDetails,
    resolveTmdbToTvdb
} from "$lib/services/backend-metadata";

const logger = createScopedLogger("id-resolver");

/** Safely extracts a string or number field from an unknown object, checking both root and external_ids */
function extractId(data: unknown, field: string): string | number | null {
    if (data == null || typeof data !== "object") return null;
    const record = data as Record<string, unknown>;

    // Check direct field
    if (record[field] != null) return record[field] as string | number;

    // Check inside external_ids
    if (record.external_ids && typeof record.external_ids === "object") {
        const ext = record.external_ids as Record<string, unknown>;
        if (ext[field] != null) return ext[field] as string | number;
    }

    return null;
}

export type Indexer = "tmdb" | "tvdb" | "imdb" | "anilist" | "riven";
export type MediaType = "movie" | "tv";

export interface ResolveOptions {
    from: Indexer;
    to: Indexer;
    id: number | string;
    mediaType: MediaType;
    customFetch: typeof fetch;
    backendUrl: string;
    apiKey: string;
    /** Optional existing data (e.g. from a previous fetch) to avoid redundant requests */
    data?: Record<string, unknown>;
}

export interface ResolveResult {
    id: number | string;
    resolved: boolean;
}

type Resolver = (options: ResolveOptions) => Promise<ResolveResult>;

// Resolver lookup table - maps "from->to" to resolver function
const resolvers: Record<string, Resolver> = {
    "tmdb->tvdb": tmdbToTvdb,
    "tmdb->imdb": tmdbToImdb,
    "anilist->tvdb": (opts) => anilistToExternal(opts, "tvdb"),
    "anilist->tmdb": (opts) => anilistToExternal(opts, "tmdb"),
    "riven->tvdb": (opts) => rivenToExternal(opts, "tvdb"),
    "riven->tmdb": (opts) => rivenToExternal(opts, "tmdb")
};

/**
 * Universal ID resolver that converts between different indexer ID systems.
 */
export async function resolveId(options: ResolveOptions): Promise<ResolveResult> {
    const { from, to, id } = options;

    if (from === to) {
        return { id, resolved: true };
    }

    const resolver = resolvers[`${from}->${to}`];
    if (!resolver) {
        logger.warn(`Unsupported conversion: ${from}->${to}`);
        return { id, resolved: false };
    }

    return resolver(options);
}

/**
 * TMDB -> TVDB (TV shows only)
 */
async function tmdbToTvdb(options: ResolveOptions): Promise<ResolveResult> {
    const { id, mediaType, backendUrl, apiKey, customFetch } = options;
    const tmdbId = Number(id);

    if (mediaType === "movie") {
        logger.warn("TMDB->TVDB conversion only supported for TV shows");
        return { id: tmdbId, resolved: false };
    }

    if (options.data) {
        const foundId = extractId(options.data, "tvdb_id");
        if (foundId != null) return { id: Number(foundId), resolved: true };
    }

    try {
        const resolved = await resolveTmdbToTvdb(
            { backendUrl, apiKey, fetch: customFetch },
            String(id)
        );
        if (resolved) {
            return { id: resolved, resolved: true };
        }
    } catch (e) {
        logger.warn(`Backend TMDB->TVDB resolution failed for ${id}:`, e);
    }

    logger.warn(`Could not resolve TMDB ${id} to TVDB`);
    return { id: tmdbId, resolved: false };
}

/**
 * TMDB -> IMDB
 */
async function tmdbToImdb(options: ResolveOptions): Promise<ResolveResult> {
    const { id, mediaType, customFetch, backendUrl, apiKey } = options;
    const tmdbId = Number(id);

    try {
        // Try to extract from existing data first
        if (options.data) {
            const foundId = extractId(options.data, "imdb_id");
            if (foundId != null) return { id: String(foundId), resolved: true };
        }

        const data = await fetchTmdbDetails<Record<string, unknown>>(
            { backendUrl, apiKey, fetch: customFetch },
            {
                type: mediaType,
                id: tmdbId,
                appendToResponse: "external_ids"
            }
        );

        const foundId = extractId(data, "imdb_id");
        if (foundId != null) {
            return { id: String(foundId), resolved: true };
        }
    } catch (e) {
        logger.warn(`Failed to resolve TMDB ${id} to IMDB:`, e);
    }

    return { id: tmdbId, resolved: false };
}

/**
 * AniList -> TVDB/TMDB via backend mapping query
 */
async function anilistToExternal(
    options: ResolveOptions,
    to: "tvdb" | "tmdb"
): Promise<ResolveResult> {
    const { id, customFetch, backendUrl, apiKey } = options;

    try {
        const mappings = await fetchAnilistMappings(
            { backendUrl, apiKey, fetch: customFetch },
            Number(id)
        );
        const resolvedId = to === "tvdb" ? mappings.tvdbId : mappings.tmdbId;

        if (resolvedId != null) {
            return { id: resolvedId, resolved: true };
        }
    } catch (e) {
        logger.warn(`Failed to resolve AniList ${id} to ${to}:`, e);
    }

    return { id, resolved: false };
}

/**
 * Riven -> TVDB/TMDB via GraphQL
 */
async function rivenToExternal(
    options: ResolveOptions,
    to: "tvdb" | "tmdb"
): Promise<ResolveResult> {
    const { id, customFetch, backendUrl, apiKey } = options;

    try {
        const field = to === "tvdb" ? "tvdbId" : "tmdbId";
        const query = `query($id: Int!) { mediaItem(id: $id) { ${field} } }`;
        const data = await gql<{ mediaItem: Record<string, string | null> | null }>(
            backendUrl,
            apiKey,
            query,
            { id: Number(id) },
            customFetch
        );

        const resolvedId = data.mediaItem?.[field];
        if (resolvedId != null) {
            return { id: resolvedId, resolved: true };
        }
    } catch (e) {
        logger.warn(`Failed to resolve Riven ${id}:`, e);
    }

    return { id, resolved: false };
}
