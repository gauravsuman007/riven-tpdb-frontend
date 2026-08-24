import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * Progressive fragmented-MP4 remux, for files whose video the browser can
 * already decode and where only the audio or the container is in the way.
 */
export const GET: RequestHandler = async ({ params, locals, fetch, url }) => {
    const { itemId } = params;

    if (!itemId || isNaN(Number(itemId))) {
        error(400, "Invalid item ID");
    }

    const backendUrl = `${locals.backendUrl}/api/v1/stream/remux/${itemId}${url.search}`;

    try {
        const response = await fetch(backendUrl, {
            headers: { "x-api-key": locals.apiKey },
            // @ts-expect-error - required for streaming bodies
            duplex: "half"
        });

        if (!response.ok) {
            error(response.status, "Failed to start remux");
        }

        return new Response(response.body, {
            status: 200,
            headers: { "content-type": "video/mp4", "cache-control": "no-store" }
        });
    } catch (e) {
        console.error("Remux proxy error:", e);
        error(502, "Failed to proxy remux");
    }
};
