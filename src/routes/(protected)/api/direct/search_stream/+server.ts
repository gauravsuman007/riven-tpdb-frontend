import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("direct-search-stream");

/**
 * SSE proxy for the per-site direct search.
 *
 * A straight passthrough of the backend's own event stream rather than a
 * re-emit through `sveltekit-sse` (as `/api/scrape_stream` does): the
 * backend already writes well-formed `data: ...\n\n` frames, so re-encoding
 * them would only add a format to keep in step. The client reads this with a
 * plain `EventSource`, which this satisfies as-is.
 *
 * The proxy exists at all because `EventSource` cannot send headers -- the
 * backend api key has to be attached somewhere the browser is not, and
 * that is here.
 */
export const GET: RequestHandler = async ({ locals, url, fetch }) => {
    if (!locals.user) error(401, "Unauthorized");

    const target =
        `${locals.backendUrl.replace(/\/$/, "")}/api/v1/direct/search_stream` +
        `?${url.searchParams.toString()}`;

    const response = await fetch(target, {
        headers: {
            "x-api-key": locals.apiKey,
            Accept: "text/event-stream",
            "Cache-Control": "no-cache"
        }
    });

    if (!response.ok || !response.body) {
        logger.error(`direct search stream upstream returned ${response.status}`);
        error(response.status === 503 ? 503 : 502, "Could not start the search");
    }

    return new Response(response.body, {
        headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            connection: "keep-alive",
            // Nothing in this deployment buffers SSE today, but a reverse
            // proxy added later that does would turn the whole point of this
            // endpoint (results appearing one site at a time) back into a
            // single delivery at the end.
            "x-accel-buffering": "no"
        }
    });
};
