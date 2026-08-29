/**
 * Direct-scrape bookmarks for one title's search panel.
 *
 * `contextTitle` is required on every verb here -- see schema/bookmarks.ts
 * for why it is what scopes a bookmark to the page it belongs to.
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { addBookmark, getBookmarks, removeBookmark } from "$lib/server/bookmarks";

function requireUser(locals: App.Locals): string {
    const id = locals.user?.id;
    if (!id) error(401, "Not signed in");
    return id;
}

export const GET: RequestHandler = async ({ url, locals }) => {
    const userId = requireUser(locals);
    const contextTitle = url.searchParams.get("contextTitle");

    if (!contextTitle) error(400, "contextTitle is required");

    return json({ bookmarks: getBookmarks(userId, contextTitle) });
};

export const POST: RequestHandler = async ({ request, locals }) => {
    const userId = requireUser(locals);
    const body = await request.json();

    const { site, videoId, contextTitle, title, pageUrl } = body ?? {};

    if (!site || !videoId || !contextTitle || !title || !pageUrl) {
        error(400, "site, videoId, contextTitle, title, and pageUrl are required");
    }

    const bookmark = addBookmark(
        userId,
        {
            site,
            videoId,
            contextTitle,
            title,
            pageUrl,
            thumbnail: body.thumbnail ?? null,
            duration: typeof body.duration === "number" ? body.duration : null,
            resolution: body.resolution ?? null,
            size: typeof body.size === "number" ? body.size : null
        },
        locals.backendUrl,
        locals.apiKey
    );

    return json({ bookmark });
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
    const userId = requireUser(locals);
    const site = url.searchParams.get("site");
    const videoId = url.searchParams.get("videoId");

    if (!site || !videoId) error(400, "site and videoId are required");

    removeBookmark(userId, site, videoId);

    return json({ ok: true });
};
