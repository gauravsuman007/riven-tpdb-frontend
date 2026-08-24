import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * Byte-range proxy for a video found on a streaming site.
 *
 * The generic backend proxy would do for the JSON endpoints, but not for this
 * one: it does not forward Range in either direction, so the browser would get
 * a 200 with no seek bar and would buffer the whole file before playing.
 */
export const GET: RequestHandler = async ({ locals, request, fetch, url }) => {
    const site = url.searchParams.get("site");
    const videoId = url.searchParams.get("video_id");

    if (!site || !videoId) {
        error(400, "site and video_id are required");
    }

    const index = url.searchParams.get("index") ?? "0";
    const target =
        `${locals.backendUrl}/api/v1/direct/stream` +
        `?site=${encodeURIComponent(site)}` +
        `&video_id=${encodeURIComponent(videoId)}` +
        `&index=${encodeURIComponent(index)}`;

    const headers: HeadersInit = { "x-api-key": locals.apiKey };
    const range = request.headers.get("range");
    if (range) headers["Range"] = range;

    try {
        const response = await fetch(target, { headers });

        if (!response.ok && response.status !== 206) {
            error(response.status, `Failed to fetch video: ${response.statusText}`);
        }

        const responseHeaders = new Headers();
        for (const header of [
            "content-type",
            "content-length",
            "content-range",
            "accept-ranges"
        ]) {
            const value = response.headers.get(header);
            if (value) responseHeaders.set(header, value);
        }

        return new Response(response.body, {
            status: response.status,
            headers: responseHeaders
        });
    } catch (e) {
        console.error("Direct stream proxy error:", e);
        error(502, "Failed to proxy video");
    }
};
