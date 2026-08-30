import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { mintDirectToken } from "$lib/server/direct-tokens";
import { toDirectGuid } from "$lib/utils/jellyfin-ids";

/**
 * A URL for a direct-scrape video that an external player can actually open.
 *
 * Mirrors `/api/stream/{itemId}/external_url` for library items. Both exist
 * for the same reason: the player's own stream URL is cookie-authenticated
 * and therefore useless to another application.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
    if (!locals.user) error(401, "Unauthorized");

    const site = url.searchParams.get("site");
    const videoId = url.searchParams.get("videoId");

    if (!site || !videoId) error(400, "site and videoId are required");

    const title = url.searchParams.get("title") ?? "";
    const token = mintDirectToken(site, videoId, url.searchParams.get("index") ?? "0", title);

    /*
        The filename is cosmetic to us and load-bearing to Android: the
        extension is what lets a video player's intent filter match at all.
        Derived from the title when there is one so the player's own UI shows
        something recognisable rather than an opaque id.
    */
    const label = (title || "video")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 60) || "video";

    /*
        `itemId` is what actually reaches a media player, and `url` is the
        fallback for everything that is not the Jellyfin shell.

        Handing the raw URL to NativeInterface.openUrl() -- the previous sole
        behaviour -- cannot produce a player chooser: that bridge fires
        Intent(ACTION_VIEW, uri) with no MIME type, so Android matches on the
        http scheme alone and a browser always wins. Reported exactly that
        way: the video opened in the browser and the chooser never appeared.
        ExternalPlayer.initPlayer() is the bridge that sets
        `setDataAndType(uri, "video/*")`, and it addresses videos by ID, so
        the video needs an id before it can be handed over properly.
    */
    return json({
        itemId: toDirectGuid(token),
        url: new URL(`/direct-play/${token}/${label}.mp4`, url.origin).href
    });
};
