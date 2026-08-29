/**
 * On-demand resolution/size for a direct-scrape video, for the player
 * overlay's description area. Same underlying resolve as the bookmark
 * enrichment path (`$lib/server/bookmarks`'s `resolveBest`) -- this is the
 * "someone is watching it right now, not just saving it" caller, so it is
 * awaited on the client rather than fired in the background, but the
 * request itself is identical either way and the two paths agree on the
 * same numbers if the video also happens to be bookmarked.
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { resolveBest } from "$lib/server/bookmarks";

export const GET: RequestHandler = async ({ url, locals }) => {
    const site = url.searchParams.get("site");
    const videoId = url.searchParams.get("videoId");

    if (!site || !videoId) error(400, "site and videoId are required");

    const result = await resolveBest(site, videoId, locals.backendUrl, locals.apiKey);

    return json(result ?? { resolution: null, size: null });
};
