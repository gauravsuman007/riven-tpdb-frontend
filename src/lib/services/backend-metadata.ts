import { gql } from "$lib/graphql-client";
import type { TMDBTransformedListItem } from "$lib/metadata/parser";

export interface BackendMetadataContext {
    backendUrl: string;
    apiKey: string;
    fetch: typeof fetch;
}

export interface GqlTmdbListItem {
    id: number;
    title: string;
    posterPath: string | null;
    mediaType: "movie" | "tv" | "person" | "company";
    year: string;
    voteAverage: number | null;
    voteCount: number | null;
    popularity?: number | null;
    overview?: string | null;
    backdropPath?: string | null;
    genreIds?: number[] | null;
    releaseDate?: string | null;
    firstAirDate?: string | null;
    originalTitle?: string | null;
    originalLanguage?: string | null;
    indexer: "tmdb" | "tvdb";
}

const TMDB_LIST_FIELDS = `
    id
    title
    posterPath
    mediaType
    year
    voteAverage
    voteCount
    popularity
    overview
    backdropPath
    genreIds
    releaseDate
    firstAirDate
    originalTitle
    originalLanguage
    indexer
`;

const TMDB_DETAILS_QUERY = `query($type: String!, $id: Int!, $appendToResponse: String) {
    tmdbDetails(type: $type, id: $id, appendToResponse: $appendToResponse)
}`;

const TMDB_COLLECTION_QUERY = `query($id: Int!) {
    tmdbCollection(id: $id)
}`;

const TMDB_TRENDING_QUERY = `query($type: String!, $timeWindow: String!, $page: Int) {
    trendingTmdb(type: $type, timeWindow: $timeWindow, page: $page) {
        results { ${TMDB_LIST_FIELDS} }
    }
}`;

const TMDB_CATEGORY_QUERY = `query($type: String!, $category: String!, $page: Int) {
    tmdbCategory(type: $type, category: $category, page: $page) {
        results { ${TMDB_LIST_FIELDS} }
    }
}`;

const SEARCH_TMDB_QUERY = `query($type: String!, $params: JSON, $searchMode: String) {
    searchTmdb(type: $type, params: $params, searchMode: $searchMode) {
        results { ${TMDB_LIST_FIELDS} }
    }
}`;

const TVDB_SERIES_QUERY = `query($id: Int!) {
    tvdbSeries(id: $id)
}`;

const TVDB_SERIES_EXTENDED_QUERY = `query($id: Int!, $meta: String) {
    tvdbSeriesExtended(id: $id, meta: $meta)
}`;

const TVDB_EPISODES_QUERY = `query($id: Int!, $seasonType: String!, $lang: String!, $page: Int) {
    tvdbEpisodes(id: $id, seasonType: $seasonType, lang: $lang, page: $page)
}`;

const RESOLVE_TMDB_TO_TVDB_QUERY = `query($tmdbId: String!) {
    resolveTmdbToTvdb(tmdbId: $tmdbId)
}`;

const ANILIST_MAPPINGS_QUERY = `query($id: Int!) {
    anilistMappings(id: $id) {
        anilistId
        tmdbId
        tvdbId
    }
}`;

export function mapGqlTmdbListItem(item: GqlTmdbListItem): TMDBTransformedListItem {
    return {
        id: item.id,
        title: item.title,
        poster_path: item.posterPath,
        media_type: item.mediaType,
        year: item.year,
        vote_average: item.voteAverage,
        vote_count: item.voteCount,
        popularity: item.popularity ?? undefined,
        overview: item.overview ?? undefined,
        backdrop_path: item.backdropPath ?? undefined,
        genre_ids: item.genreIds ?? undefined,
        release_date: item.releaseDate ?? undefined,
        first_air_date: item.firstAirDate ?? undefined,
        original_title: item.originalTitle ?? undefined,
        original_language: item.originalLanguage ?? undefined,
        indexer: item.indexer
    };
}

export function mapGqlTmdbList(items: GqlTmdbListItem[]): TMDBTransformedListItem[] {
    return items.map(mapGqlTmdbListItem);
}

export async function fetchTmdbDetails<T>(
    ctx: BackendMetadataContext,
    options: {
        type: "movie" | "tv" | "person" | "company";
        id: number;
        appendToResponse?: string;
    }
) {
    const data = await gql<{ tmdbDetails: T }>(
        ctx.backendUrl,
        ctx.apiKey,
        TMDB_DETAILS_QUERY,
        options,
        ctx.fetch
    );
    return data.tmdbDetails;
}

export async function fetchTmdbCollection<T>(ctx: BackendMetadataContext, id: number) {
    const data = await gql<{ tmdbCollection: T }>(
        ctx.backendUrl,
        ctx.apiKey,
        TMDB_COLLECTION_QUERY,
        { id },
        ctx.fetch
    );
    return data.tmdbCollection;
}

export async function fetchTmdbTrending(
    ctx: BackendMetadataContext,
    options: {
        type: "movie" | "tv" | "all";
        timeWindow: "day" | "week";
        page?: number;
    }
) {
    const data = await gql<{ trendingTmdb: { results: GqlTmdbListItem[] } }>(
        ctx.backendUrl,
        ctx.apiKey,
        TMDB_TRENDING_QUERY,
        options,
        ctx.fetch
    );
    return data.trendingTmdb.results;
}

export async function fetchTmdbCategory(
    ctx: BackendMetadataContext,
    options: {
        type: "movie" | "tv";
        category: "popular" | "top_rated";
        page?: number;
    }
) {
    const data = await gql<{ tmdbCategory: { results: GqlTmdbListItem[] } }>(
        ctx.backendUrl,
        ctx.apiKey,
        TMDB_CATEGORY_QUERY,
        options,
        ctx.fetch
    );
    return data.tmdbCategory.results;
}

export async function searchTmdb(
    ctx: BackendMetadataContext,
    options: {
        type: "movie" | "tv" | "person" | "company";
        params?: Record<string, unknown>;
        searchMode?: "search" | "discover" | "hybrid";
    }
) {
    const data = await gql<{ searchTmdb: { results: GqlTmdbListItem[] } }>(
        ctx.backendUrl,
        ctx.apiKey,
        SEARCH_TMDB_QUERY,
        options,
        ctx.fetch
    );
    return data.searchTmdb.results;
}

export async function fetchTvdbSeries<T>(ctx: BackendMetadataContext, id: number) {
    const data = await gql<{ tvdbSeries: T }>(
        ctx.backendUrl,
        ctx.apiKey,
        TVDB_SERIES_QUERY,
        { id },
        ctx.fetch
    );
    return data.tvdbSeries;
}

export async function fetchTvdbSeriesExtended<T>(
    ctx: BackendMetadataContext,
    id: number,
    meta?: string
) {
    const data = await gql<{ tvdbSeriesExtended: T }>(
        ctx.backendUrl,
        ctx.apiKey,
        TVDB_SERIES_EXTENDED_QUERY,
        { id, meta },
        ctx.fetch
    );
    return data.tvdbSeriesExtended;
}

export async function fetchTvdbEpisodes<T>(
    ctx: BackendMetadataContext,
    options: {
        id: number;
        seasonType: string;
        lang: string;
        page?: number;
    }
) {
    const data = await gql<{ tvdbEpisodes: T }>(
        ctx.backendUrl,
        ctx.apiKey,
        TVDB_EPISODES_QUERY,
        options,
        ctx.fetch
    );
    return data.tvdbEpisodes;
}

export async function resolveTmdbToTvdb(ctx: BackendMetadataContext, tmdbId: string) {
    const data = await gql<{ resolveTmdbToTvdb: number | null }>(
        ctx.backendUrl,
        ctx.apiKey,
        RESOLVE_TMDB_TO_TVDB_QUERY,
        { tmdbId },
        ctx.fetch
    );
    return data.resolveTmdbToTvdb;
}

export async function fetchAnilistMappings(ctx: BackendMetadataContext, id: number) {
    const data = await gql<{
        anilistMappings: {
            anilistId: number;
            tmdbId: number | null;
            tvdbId: number | null;
        };
    }>(ctx.backendUrl, ctx.apiKey, ANILIST_MAPPINGS_QUERY, { id }, ctx.fetch);
    return data.anilistMappings;
}
