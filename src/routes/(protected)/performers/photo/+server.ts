/**
 * One performer's picture, from the backend's TPDB cache.
 * See `program/apis/tpdb_images.py` in the backend for the size it is stored
 * at, the hosts it will fetch from, and the cache budget it counts against.
 */

import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url, locals, fetch }) => {
    if (!locals.user) error(401, "Not signed in");

    const source = url.searchParams.get("u");

    if (!source) error(404, "No such picture");

    const response = await fetch(
        `${locals.backendUrl}/api/v1/tpdb/performer-image?url=${encodeURIComponent(source)}`,
        { headers: { "x-api-key": locals.apiKey } }
    );

    if (!response.ok) error(404, "No picture");

    return new Response(response.body, {
        headers: {
            "content-type": "image/webp",
            // Keyed by the source URL, so a changed picture is a new address.
            "cache-control": "public, max-age=31536000, immutable",
            "x-content-type-options": "nosniff"
        }
    });
};
