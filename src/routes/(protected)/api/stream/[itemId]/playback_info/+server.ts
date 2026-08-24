import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * What the file actually contains, so the player can pick a mode.
 *
 * The player used to ask the browser whether it supported HEVC and never looked
 * at the file, which sent every Firefox viewer through the transcoder.
 */
export const GET: RequestHandler = async ({ params, locals, fetch }) => {
    const { itemId } = params;

    if (!itemId || isNaN(Number(itemId))) {
        error(400, "Invalid item ID");
    }

    try {
        const response = await fetch(`${locals.backendUrl}/api/v1/stream/playback_info/${itemId}`, {
            headers: { "x-api-key": locals.apiKey }
        });

        if (!response.ok) {
            error(response.status, `Failed to inspect media: ${response.statusText}`);
        }

        return json(await response.json());
    } catch (e) {
        // A failed probe is not fatal -- the player falls back to direct play.
        console.error("Playback info error:", e);
        error(502, "Failed to inspect media");
    }
};
