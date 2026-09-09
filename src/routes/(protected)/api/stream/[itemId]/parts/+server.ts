import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * The playable files of one title, in playing order.
 *
 * A scene compilation is one torrent holding five or six separate scenes.
 * Every title answers here, single-file ones with a one-entry list, so the
 * player has one shape to handle rather than a special case.
 */
export const GET: RequestHandler = async ({ params, locals, fetch }) => {
    const { itemId } = params;

    if (!itemId || isNaN(Number(itemId))) {
        error(400, "Invalid item ID");
    }

    try {
        const response = await fetch(`${locals.backendUrl}/api/v1/stream/parts/${itemId}`, {
            headers: { "x-api-key": locals.apiKey }
        });

        if (!response.ok) {
            // Degraded rather than fatal: a player that cannot get the part
            // list falls back to playing part 0, which is what it did before
            // playlists existed.
            return json({ item_id: Number(itemId), title: "", parts: [] });
        }

        return json(await response.json());
    } catch (e) {
        console.error("Media parts lookup failed:", e);
        return json({ item_id: Number(itemId), title: "", parts: [] });
    }
};
