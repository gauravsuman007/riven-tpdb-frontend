import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * Proxy live log SSE stream from the Rust backend to the browser.
 * The Rust backend emits SSE events named "log" with JSON payloads
 * matching { timestamp, level, message, target }.
 */
// sveltekit-sse uses POST by default, so we need to handle both methods.
export const POST: RequestHandler = async (event) => GET(event);

export const GET: RequestHandler = async ({ locals, fetch }) => {
    if (!locals.user || !locals.session) {
        error(401, "Unauthorized");
    }

    const backendUrl = locals.backendUrl;
    const apiKey = locals.apiKey;

    const upstream = await fetch(`${backendUrl}/logs/stream`, {
        headers: {
            "x-api-key": apiKey ?? "",
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
        },
    });

    if (!upstream.ok || !upstream.body) {
        error(upstream.status, "Failed to connect to log stream");
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
