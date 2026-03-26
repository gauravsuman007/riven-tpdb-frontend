import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * Proxy real-time notification SSE stream from the Rust backend.
 * The Rust backend emits SSE events named "notification" with JSON payloads
 * matching the serialised RivenEvent shape (tagged by "type" field).
 */
// sveltekit-sse uses POST by default, so we need to handle both methods.
export const POST: RequestHandler = async (event) => GET(event);

export const GET: RequestHandler = async ({ locals, fetch }) => {
    if (!locals.user || !locals.session) {
        error(401, "Unauthorized");
    }

    const backendUrl = locals.backendUrl;
    const apiKey = locals.apiKey;

    const upstream = await fetch(`${backendUrl}/notifications/stream`, {
        headers: {
            "x-api-key": apiKey ?? "",
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
        },
    });

    if (!upstream.ok || !upstream.body) {
        error(upstream.status, "Failed to connect to notification stream");
    }

    return new Response(upstream.body, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
};
