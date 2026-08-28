/**
 * Translate Riven's library (as JSON, from the backend's plain API) into the
 * shapes Jellyfin clients expect.
 *
 * Adapted from the backend's former `program/services/jellyfin_server/mapping.py`.
 * That version read SQLAlchemy model attributes directly; this one reads the
 * plain dicts `MediaItem.to_dict()`/`to_extended_dict()` already produce over
 * HTTP, since the frontend has no database access of its own.
 *
 * Plain objects rather than strict types, deliberately: Jellyfin's schema is
 * enormous, clients are inconsistent about which fields they require, and the
 * cost of being wrong is a client that silently renders nothing. Keeping the
 * exact wire shape visible here lets a field be added because a real client
 * asked for it -- see the frontend AGENTS.md on measuring rather than
 * implementing the documented API.
 *
 *     scene            -> Movie          (not Series/Episode)
 *     performers       -> People, Type "Actor"
 *     site_name/network-> Studios
 *     tpdb_id          -> ProviderIds
 */

import { LIBRARY_ID, SERVER_ID, syntheticGuid, toGuid } from "$lib/utils/jellyfin-ids";

// Jellyfin measures time in 100-nanosecond ticks, everywhere.
const TICKS_PER_SECOND = 10_000_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

export function toTicks(seconds: number | null | undefined): number | null {
    return seconds ? Math.round(seconds * TICKS_PER_SECOND) : null;
}

function iso(value: string | null | undefined): string | null {
    if (!value || value === "None") return null;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return null;

    return date.toISOString();
}

function yearFromDate(value: string | null | undefined): number | null {
    const parsed = iso(value);

    return parsed ? new Date(parsed).getUTCFullYear() : null;
}

/**
 * Studio for a scene is the site it came from. `network` is the TPDB parent
 * network and `site_name` the specific site; both are shown when they
 * differ, because "Brazzers" and "Brazzers University" are genuinely
 * different levels and a client browsing by studio wants the one it has.
 */
function studioNames(item: Json): string[] {
    const names: string[] = [];

    for (const value of [item.network, item.site_name]) {
        const cleaned = (value || "").trim();

        if (cleaned && !names.includes(cleaned)) names.push(cleaned);
    }

    return names;
}

async function imageTag(item: Json): Promise<string> {
    const data = new TextEncoder().encode(item.poster_path || "");
    const digest = await crypto.subtle.digest("SHA-256", data);

    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 16);
}

/**
 * One library item as a Jellyfin BaseItemDto.
 *
 * `mediaSource`, when given, adds MediaSources/MediaStreams -- the details
 * screen and playback need it; a grid of a thousand posters very much does
 * not, and building it means an extra backend call per item.
 */
export async function baseItem(
    item: Json,
    mediaSource?: { container: string | null; durationSeconds: number | null } | null
): Promise<Json> {
    const studios = studioNames(item);

    const dto: Json = {
        Id: toGuid(Number(item.id)),
        ServerId: SERVER_ID,
        Name: item.title || "Untitled",
        Type: "Movie",
        MediaType: "Video",
        IsFolder: false,
        LocationType: "FileSystem",
        ParentId: LIBRARY_ID,
        RunTimeTicks: toTicks(mediaSource?.durationSeconds ?? null),
        ProductionYear: yearFromDate(item.aired_at),
        PremiereDate: iso(item.aired_at),
        CommunityRating: item.rating ?? null,
        OfficialRating: item.content_rating ?? null,
        Genres: Array.isArray(item.genres) ? item.genres : [],
        Studios: await Promise.all(
            studios.map(async (name) => ({ Name: name, Id: await syntheticGuid("studio", name) }))
        ),
        People: await Promise.all(
            (item.performers || []).map(async (name: string) => ({
                Name: name,
                Id: await syntheticGuid("person", name),
                Type: "Actor",
                Role: ""
            }))
        ),
        ProviderIds: Object.fromEntries(
            (
                [
                    ["Tpdb", item.tpdb_id],
                    ["Imdb", item.imdb_id],
                    ["Tmdb", item.tmdb_id]
                ] as const
            ).filter(([, value]) => Boolean(value))
        ),
        // Clients cache images against this tag and will not re-fetch until it
        // changes, so it must be derived from something that moves with the
        // image (the poster path itself).
        ImageTags: item.poster_path ? { Primary: await imageTag(item) } : {},
        BackdropImageTags: [],
        UserData: {
            PlaybackPositionTicks: 0,
            PlayCount: 0,
            Played: false,
            IsFavorite: false,
            Key: String(item.id)
        }
    };

    if (mediaSource) {
        dto.MediaSources = [
            mediaSourceDto(Number(item.id), item.title, mediaSource.container, mediaSource.durationSeconds)
        ];
        dto.MediaStreams = [];
    }

    return dto;
}

/**
 * One playable source.
 *
 * `SupportsDirectPlay` is false even when the file would play untouched:
 * direct play means the CLIENT opens the path itself, and the real path is
 * inside a FUSE mount on the backend host no client can reach. Direct STREAM
 * is the equivalent -- the client gets bytes from us without transcoding,
 * which is what `/Videos/{id}/stream` (proxied to the backend's existing
 * `/api/v1/stream/file/{id}`) already does.
 */
export function mediaSourceDto(
    itemId: number,
    title: string | null,
    container: string | null,
    durationSeconds: number | null
): Json {
    return {
        Id: toGuid(itemId),
        Protocol: "Http",
        Type: "Default",
        Name: title || "Untitled",
        Container: container,
        RunTimeTicks: toTicks(durationSeconds),
        IsRemote: false,
        ReadAtNativeFramerate: false,
        IgnoreDts: false,
        IgnoreIndex: false,
        GenPtsInput: false,
        SupportsTranscoding: true,
        SupportsDirectStream: true,
        SupportsDirectPlay: false,
        RequiresOpening: false,
        RequiresClosing: false,
        SupportsProbing: false,
        // The Kotlin SDK's MediaSourceInfo serializer has no defaults for
        // these -- a genuinely absent key throws MissingFieldException
        // client-side and silently aborts playback after PlaybackInfo
        // otherwise looks like it succeeded. Found via real device logcat,
        // not guessed.
        IsInfiniteStream: false,
        RequiresLooping: false,
        TranscodingSubProtocol: null,
        HasSegments: false,
        MediaStreams: [],
        MediaAttachments: [],
        Formats: []
    };
}
