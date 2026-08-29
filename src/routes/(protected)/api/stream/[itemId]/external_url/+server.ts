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
export const GET: RequestHandler = async ({ params, locals, url }) => {
    if (!locals.user) error(401, "Unauthorized");

    const itemId = Number(params.itemId);

    if (!Number.isInteger(itemId) || itemId <= 0) error(400, "Invalid item ID");

    // The stream routes only exist when the Jellyfin surface is switched on.
    // Reported rather than 500'd: the caller's sensible response is to hide
    // the control, not to show an error for something that was never
    // configured.
    if (!jellyfinEnabled()) return json({ url: null, reason: "jellyfin-disabled" });

    const token = issuePlaySession(itemId);

    // Absolute: this is handed to another application, which has no page to
    // resolve a relative path against.
    const streamUrl = new URL(
        `/Videos/${toGuid(itemId)}/stream?static=true&playSessionId=${token}`,
        url.origin
    ).href;

    return json({ url: streamUrl });
};
