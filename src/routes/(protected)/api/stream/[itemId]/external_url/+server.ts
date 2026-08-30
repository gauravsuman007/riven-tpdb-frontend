import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { jellyfinEnabled } from "$lib/server/jellyfin/config";
import { issuePlaySession } from "$lib/server/jellyfin/play-sessions";
import { toGuid } from "$lib/utils/jellyfin-ids";

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
async function containerFor(fetcher: typeof fetch, backendUrl: string, apiKey: string, itemId: number) {
    try {
        const response = await fetcher(`${backendUrl}/api/v1/stream/playback_info/${itemId}`, {
            headers: { "x-api-key": apiKey }
        });

        if (!response.ok) return "mp4";

        const container = (await response.json())?.probe?.container;

        // Some probes report a comma-separated list ("mov,mp4,m4a,..."); the
        // first entry is the one to name.
        const first = String(container ?? "").split(",")[0].trim().toLowerCase();

        return /^[a-z0-9]{2,5}$/.test(first) ? first : "mp4";
    } catch {
        return "mp4";
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
    const container = await containerFor(fetch, locals.backendUrl, locals.apiKey, itemId);

    // Absolute: this is handed to another application, which has no page to
    // resolve a relative path against.
    const streamUrl = new URL(
        `/Videos/${toGuid(itemId)}/stream.${container}?static=true&playSessionId=${token}`,
        url.origin
    ).href;

    return json({ url: streamUrl });
};
