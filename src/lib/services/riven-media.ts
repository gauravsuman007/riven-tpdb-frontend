import type { RivenMediaItem } from "$lib/types/riven";

export interface GqlFilesystemEntry {
    id?: number | null;
    fileSize?: number | null;
    originalFilename?: string | null;
    downloadUrl?: string | null;
    streamUrl?: string | null;
    provider?: string | null;
    providerDownloadId?: string | null;
    path?: string | null;
    plugin?: string | null;
    rankingProfileName?: string | null;
    mediaMetadata?: unknown;
}

export interface GqlEpisodeFull {
    episodeNumber: number;
    state: string;
    filesystemEntry?: GqlFilesystemEntry | null;
    filesystemEntries?: GqlFilesystemEntry[];
}

export interface GqlSeasonFull {
    seasonNumber: number;
    state: string;
    isRequested: boolean;
    episodes?: GqlEpisodeFull[];
}

export interface GqlMediaItemFull {
    id: number;
    state: string;
    imdbId?: string | null;
    tmdbId?: string | null;
    tvdbId?: string | null;
    filesystemEntry?: GqlFilesystemEntry | null;
    filesystemEntries?: GqlFilesystemEntry[];
    seasons?: GqlSeasonFull[];
}

export interface GqlMediaItemState {
    id: number;
    state: string;
    imdbId?: string | null;
    tmdbId?: string | null;
    tvdbId?: string | null;
}

export interface GqlEpisodeState {
    id: number;
    episodeNumber?: number | null;
    state: string;
}

export interface GqlSeasonState {
    id: number;
    seasonNumber?: number | null;
    state: string;
    isRequested: boolean;
    expectedFileCount: number;
    episodes?: GqlEpisodeState[];
}

export interface GqlMediaItemStateTree {
    id: number;
    state: string;
    imdbId?: string | null;
    tmdbId?: string | null;
    tvdbId?: string | null;
    expectedFileCount: number;
    seasons?: GqlSeasonState[];
}

const MEDIA_ITEM_FULL_FIELDS = `
    id state imdbId tmdbId tvdbId
    filesystemEntry {
        id fileSize originalFilename downloadUrl streamUrl
        provider providerDownloadId path plugin rankingProfileName mediaMetadata
    }
    filesystemEntries {
        id fileSize originalFilename downloadUrl streamUrl
        provider providerDownloadId path plugin rankingProfileName mediaMetadata
    }
    seasons {
        seasonNumber state isRequested
        episodes {
            episodeNumber state
            filesystemEntry {
                id fileSize originalFilename downloadUrl streamUrl
                provider providerDownloadId path plugin rankingProfileName mediaMetadata
            }
            filesystemEntries {
                id fileSize originalFilename downloadUrl streamUrl
                provider providerDownloadId path plugin rankingProfileName mediaMetadata
            }
        }
    }
`;

const MEDIA_ITEM_STATE_FIELDS = `
    id state imdbId tmdbId tvdbId expectedFileCount
    seasons {
        id seasonNumber state isRequested expectedFileCount
        episodes {
            id episodeNumber state
        }
    }
`;

export const MEDIA_ITEM_FULL_BY_TMDB_QUERY = `query($tmdbId: String!) {
    mediaItemFullByTmdb(tmdbId: $tmdbId) {
        ${MEDIA_ITEM_FULL_FIELDS}
    }
}`;

export const MEDIA_ITEM_FULL_BY_TVDB_QUERY = `query($tvdbId: String!) {
    mediaItemFullByTvdb(tvdbId: $tvdbId) {
        ${MEDIA_ITEM_FULL_FIELDS}
    }
}`;

export const MEDIA_ITEM_BY_TMDB_QUERY = `query($tmdbId: String!) {
    mediaItemByTmdb(tmdbId: $tmdbId) {
        id state imdbId tmdbId tvdbId
    }
}`;

export const MEDIA_ITEM_BY_TVDB_QUERY = `query($tvdbId: String!) {
    mediaItemByTvdb(tvdbId: $tvdbId) {
        id state imdbId tmdbId tvdbId
    }
}`;

export const MEDIA_ITEM_BY_ID_QUERY = `query($id: Int!) {
    mediaItem(id: $id) {
        id state imdbId tmdbId tvdbId
    }
}`;

export const MEDIA_ITEM_STATE_UPDATES_BY_TMDB_SUBSCRIPTION = `subscription($tmdbId: String!) {
    mediaItemStateUpdatesByTmdb(tmdbId: $tmdbId) {
        ${MEDIA_ITEM_STATE_FIELDS}
    }
}`;

export const MEDIA_ITEM_STATE_UPDATES_BY_TVDB_SUBSCRIPTION = `subscription($tvdbId: String!) {
    mediaItemStateUpdatesByTvdb(tvdbId: $tvdbId) {
        ${MEDIA_ITEM_STATE_FIELDS}
    }
}`;

export const MEDIA_ITEM_STATE_BY_TMDB_QUERY = `query($tmdbId: String!) {
    mediaItemStateByTmdb(tmdbId: $tmdbId) {
        ${MEDIA_ITEM_STATE_FIELDS}
    }
}`;

export const MEDIA_ITEM_STATE_BY_TVDB_QUERY = `query($tvdbId: String!) {
    mediaItemStateByTvdb(tvdbId: $tvdbId) {
        ${MEDIA_ITEM_STATE_FIELDS}
    }
}`;

function mapFsEntry(
    entry: GqlFilesystemEntry
): RivenMediaItem["filesystem_entry"] & { id?: number; ranking_profile_name?: string } {
    return {
        id: entry.id ?? undefined,
        file_size: entry.fileSize ?? undefined,
        original_filename: entry.originalFilename ?? undefined,
        download_url: entry.downloadUrl ?? undefined,
        stream_url: entry.streamUrl ?? undefined,
        provider: entry.provider ?? undefined,
        provider_download_id: entry.providerDownloadId ?? undefined,
        path: entry.path ?? undefined,
        plugin: entry.plugin ?? undefined,
        ranking_profile_name: entry.rankingProfileName ?? undefined,
        media_metadata: entry.mediaMetadata as import("$lib/types/riven").MediaMetadata | undefined
    };
}

export function mapMediaItemFull(raw: GqlMediaItemFull | null | undefined): RivenMediaItem | null {
    if (!raw) {
        return null;
    }

    return {
        id: raw.id,
        state: raw.state,
        imdb_id: raw.imdbId ?? undefined,
        tmdb_id: raw.tmdbId ?? undefined,
        tvdb_id: raw.tvdbId ?? undefined,
        media_metadata: raw.filesystemEntry?.mediaMetadata as RivenMediaItem["media_metadata"],
        filesystem_entry: raw.filesystemEntry ? mapFsEntry(raw.filesystemEntry) : undefined,
        filesystem_entries: raw.filesystemEntries?.map(mapFsEntry) ?? [],
        seasons: raw.seasons?.map((season) => ({
            season_number: season.seasonNumber,
            state: season.state,
            is_requested: season.isRequested,
            episodes: season.episodes?.map((episode) => ({
                episode_number: episode.episodeNumber,
                state: episode.state,
                media_metadata: episode.filesystemEntry
                    ?.mediaMetadata as RivenMediaItem["media_metadata"],
                filesystem_entry: episode.filesystemEntry
                    ? mapFsEntry(episode.filesystemEntry)
                    : undefined,
                filesystem_entries: episode.filesystemEntries?.map(mapFsEntry) ?? []
            }))
        }))
    };
}

export function mapMediaItemStateTree(
    raw: GqlMediaItemStateTree | null | undefined
): RivenMediaItem | null {
    if (!raw) {
        return null;
    }

    return {
        id: raw.id,
        state: raw.state,
        imdb_id: raw.imdbId ?? undefined,
        tmdb_id: raw.tmdbId ?? undefined,
        tvdb_id: raw.tvdbId ?? undefined,
        seasons: raw.seasons?.map((season) => ({
            season_number: season.seasonNumber ?? 0,
            state: season.state,
            is_requested: season.isRequested,
            episodes: season.episodes?.map((episode) => ({
                episode_number: episode.episodeNumber ?? 0,
                state: episode.state
            }))
        }))
    };
}

export interface GqlExpectedSeason {
    seasonNumber: number;
    expectedFileCount: number;
}

export interface GqlExpectedCounts {
    expectedFileCount: number;
    seasons?: GqlExpectedSeason[];
}

export const MEDIA_ITEM_EXPECTED_COUNTS_QUERY = `query($id: Int!) {
    mediaItemById(id: $id) {
        ... on Movie {
            expectedFileCount
        }
        ... on Show {
            expectedFileCount
            seasons(includeSpecials: false) {
                seasonNumber
                expectedFileCount
            }
        }
    }
}`;

export function mapMediaItemState(
    raw: GqlMediaItemState | null | undefined
): RivenMediaItem | null {
    if (!raw) {
        return null;
    }

    return {
        id: raw.id,
        state: raw.state,
        imdb_id: raw.imdbId ?? undefined,
        tmdb_id: raw.tmdbId ?? undefined,
        tvdb_id: raw.tvdbId ?? undefined
    };
}
