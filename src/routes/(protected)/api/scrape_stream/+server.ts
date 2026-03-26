/**
 * Manual scraping via SSE is not supported in the new Rust backend.
 * Scraping is handled automatically by the backend's internal queue.
 */
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { produce } from "sveltekit-sse";

export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.user || !locals.session) {
        error(401, "Unauthorized");
    }

    return produce(async function start({ emit, lock }) {
        emit(
            "message",
            JSON.stringify({
                event: "error",
                message:
                    "Manual scraping is not supported in the new backend. Scraping runs automatically."
            })
        );
        lock.set(false);
        return function stop() {};
    });
};
