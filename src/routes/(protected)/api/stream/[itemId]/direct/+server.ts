import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * A URL the player can fetch straight from the debrid CDN, when there is one.
 *
 * Proxying video makes this server's connection the ceiling for playback:
 * every byte crosses it inbound from the provider and outbound to the player,
 * and every seek pays both again. When the CDN can serve the player itself,
 * it should.
 *
 * The backend decides whether that is safe and answers `{url: null, reason}`
 * when it is not -- disabled in settings, routed through the VPN, or a
 * provider whose links only work from this server. That is a normal answer,
 * not an error: the player falls back to the proxied route.
 */
export const GET: RequestHandler = async ({ params, locals, fetch, url }) => {
    const { itemId } = params;

    if (!itemId || isNaN(Number(itemId))) {
        error(400, "Invalid item ID");
    }

    try {
        const response = await fetch(
            `${locals.backendUrl}/api/v1/stream/direct/${itemId}${url.search}`,
            {
                headers: { "x-api-key": locals.apiKey }
            }
        );

        if (!response.ok) {
            // Not fatal, and deliberately not an error status: the caller
            // treats "no url" and "could not ask" identically.
            return json({ url: null, reason: `backend returned ${response.status}` });
        }

        return json(await response.json());
    } catch (e) {
        console.error("Direct playback lookup failed:", e);
        return json({ url: null, reason: "could not reach the backend" });
    }
};
