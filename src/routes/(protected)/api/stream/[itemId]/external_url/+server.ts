import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { jellyfinEnabled } from "$lib/server/jellyfin/config";
import { issuePlaySession } from "$lib/server/jellyfin/play-sessions";
import { mintPathToken } from "$lib/server/direct-tokens";
import { toDirectGuid, toGuid } from "$lib/utils/jellyfin-ids";

/**
 * A URL for this library item that an external app can actually open.
 *
 * The player's own `/api/stream/{itemId}` cannot be handed to MX Player or
 * VLC: it lives under `(protected)` and authenticates with the browser's
 * session cookie, which another app does not have and cannot be given.
 *
 * The Jellyfin stream route can, because it already accepts a play-session
 * id as a capability token (see `jellyfin/play-sessions.ts`) -- narrower
 * than the API key in every dimension: one item, expiring, useless on any
 * other route. Minting one here, from a request the session cookie has
 * already authenticated, is the same trust step PlaybackInfo performs; this
 * just skips the Jellyfin-protocol round trip the page would otherwise need
 * to make to get one.
 */
/**
 * The container extension to end the URL with, or "mp4" if it cannot be
 * determined.
 *
 * Never throws and never blocks the link: an unknown container is a worse
 * guess, not a failure.
 */
async function containerFor(
    fetcher: typeof fetch,
    backendUrl: string,
    apiKey: string,
    itemId: number
) {
    try {
        const response = await fetcher(`${backendUrl}/api/v1/stream/playback_info/${itemId}`, {
            headers: { "x-api-key": apiKey }
        });

        if (!response.ok) return "mp4";

        const container = (await response.json())?.probe?.container;

        // Some probes report a comma-separated list ("mov,mp4,m4a,..."); the
        // first entry is the one to name.
        const first = String(container ?? "")
            .split(",")[0]
            .trim()
            .toLowerCase();

        return /^[a-z0-9]{2,5}$/.test(first) ? first : "mp4";
    } catch {
        return "mp4";
    }
}

/**
 * Which playable files this title has.
 *
 * Empty on any failure: a title that cannot be asked is played the way every
 * title was played before playlists existed, which is right for all but the
 * handful of releases this feature is for.
 *
 * The files themselves and not just a count, because each one is handed to
 * the external player as an item of its own and needs a name on the queue.
 */
async function partsInfo(
    fetcher: typeof fetch,
    backendUrl: string,
    apiKey: string,
    itemId: number
): Promise<{ parts: { index: number; title: string }[]; title: string }> {
    try {
        const response = await fetcher(`${backendUrl}/api/v1/stream/parts/${itemId}`, {
            headers: { "x-api-key": apiKey }
        });

        if (!response.ok) return { parts: [], title: "" };

        const payload = await response.json();

        return {
            parts: ((payload?.parts ?? []) as { index?: unknown; title?: unknown }[]).map(
                (entry) => ({
                    index: Number(entry?.index ?? 0),
                    title: String(entry?.title ?? "")
                })
            ),
            // The release's own name, because it is what an external player
            // has to label the whole thing with.
            title: String(payload?.title ?? "")
        };
    } catch {
        return { parts: [], title: "" };
    }
}

export const GET: RequestHandler = async ({ params, locals, url, fetch }) => {
    if (!locals.user) error(401, "Unauthorized");

    const itemId = Number(params.itemId);

    if (!Number.isInteger(itemId) || itemId <= 0) error(400, "Invalid item ID");

    // The stream routes only exist when the Jellyfin surface is switched on.
    // Reported rather than 500'd: the caller's sensible response is to hide
    // the control, not to show an error for something that was never
    // configured.
    if (!jellyfinEnabled()) return json({ url: null, reason: "jellyfin-disabled" });

    const token = issuePlaySession(itemId);

    /*
        The path must END IN A FILE EXTENSION, and that is not cosmetic.

        This URL is handed to Android through `NativeInterface.openUrl`, which
        fires `Intent(ACTION_VIEW, uri)` with NO MIME type. Android then
        resolves it against the intent filters, and an extensionless http URL
        matches only things that declare the http scheme with no type -- i.e.
        browsers. Reported exactly that way, twice: "open in external player"
        opened Firefox. Media players (MX Player, VLC) additionally declare
        `pathPattern` filters for `.*\\.mp4` and friends, so ending the path
        with the real container is what puts them in the chooser at all.

        `/Videos/{id}/stream.{container}` is an existing route and serves the
        same bytes as `/stream`.
    */
    const [container, info] = await Promise.all([
        containerFor(fetch, locals.backendUrl, locals.apiKey, itemId),
        partsInfo(fetch, locals.backendUrl, locals.apiKey, itemId)
    ]);
    const parts = Math.max(1, info.parts.length);

    /** One file of this release, as a URL that ends in its real container. */
    const partPath = (index: number): string => {
        const query = new URLSearchParams({ static: "true", playSessionId: token });

        // Part 0 is the backend's default, so it is left off -- the URL for a
        // single-file title stays exactly what it was before parts existed.
        if (index > 0) query.set("part", String(index));

        return `/Videos/${toGuid(itemId)}/stream.${container}?${query}`;
    };

    const playlistPath = `/Videos/${toGuid(itemId)}/playlist.m3u?playSessionId=${token}`;

    // The URL form -- the last resort, for a shell with `openUrl` and no
    // player bridge, and the source of the desktop `.m3u` download. A
    // multi-file release can only be named as a whole by its playlist here,
    // because a bare URL is one stream and there is nothing else to put the
    // rest of the release in.
    const path = parts > 1 ? playlistPath : partPath(0);

    // Absolute: this is handed to another application, which has no page to
    // resolve a relative path against.
    const streamUrl = new URL(path, url.origin).href;

    /*
        A multi-file release goes over as ONE ID PER FILE, and this is the
        third attempt at it -- the first two each failed in a real player, so
        the reasoning matters.

        Attempt one handed over the item's own id. The backend defaults the
        part to 0, so a six-scene compilation started the external player on
        scene one with no way to reach the rest.

        Attempt two handed over the playlist URL, which lost the chooser:
        `openUrl` fires `Intent(ACTION_VIEW, uri)` with NO MIME type, Android
        matches the http scheme alone, and the default browser wins. `.m3u`
        does not rescue it -- the pathPattern filters media players declare
        are an ADDITION to the browsers already matching, not a replacement.

        Attempt three minted ONE id standing for that playlist URL, so it
        travelled the typed-intent bridge. The server side of that was
        verified end to end and the client side never was, which is the whole
        of why this came back: the player is handed `playlist.m3u`, served
        `audio/x-mpegurl` -- and that is the HLS media type. ffmpeg, ExoPlayer
        and MX Player all route it to their HLS demuxer, which then rejects a
        plain `#EXTM3U`/`#EXTINF` list because it carries none of the
        `#EXT-X-` tags HLS requires. Reported as the title simply failing in
        MX Player while single files and scraped videos played.

        There is no MIME type that says "plain multi-entry playlist" and is
        not also claimed by an HLS parser, so the permanent fix is to stop
        asking a player to parse a playlist at all. `PlayOptions.ids` is a
        LIST (see `bundle.ts`, and `ExternalPlayer.initPlayer` /
        `NativePlayer.loadPlayer`, which both take the same JSON): handing
        over one id per file makes the queue the player's own, built from
        plain video URLs on the path that has always worked for a single
        file. Nothing has to understand a playlist for the release to play
        through.

        Single-file titles keep the real item id, which the player already has
        a catalogue entry for.
    */
    const itemIds =
        parts > 1
            ? info.parts.map((entry) =>
                  toDirectGuid(
                      mintPathToken(
                          partPath(entry.index),
                          // Named for the queue the player builds, which has
                          // nothing else to label a row with.
                          entry.title || `${info.title || "Video"} - file ${entry.index + 1}`,
                          container
                      )
                  )
              )
            : null;

    /*
        The playlist form, for a desktop browser: no desktop player registers
        a URL scheme a page can count on, but a downloaded `.m3u` opens in
        whatever the default player is on all three desktop systems. It
        carries the same play-session token as the stream URL, and for a
        multi-file release it is the same playlist the native hand-off uses.
    */
    const m3uUrl = new URL(playlistPath, url.origin).href;

    // `itemId` is kept beside `itemIds` for the single-file shape every other
    // caller already understands: null here means "use the item's own id".
    return json({ url: streamUrl, parts, itemId: itemIds?.[0] ?? null, itemIds, m3uUrl });
};
