/**
 * A library item's wide art, by item id: the player holds nothing else,
 * whichever page opened it. 404 when the title has none, and the player
 * keeps its tall poster.
 */

import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, locals, fetch }) => {
    if (!locals.user) error(401, "Not signed in");

    const id = Number(params.id);

    if (!Number.isInteger(id) || id <= 0) error(404, "No such item");

    const response = await fetch(`${locals.backendUrl}/api/v1/tpdb/items/${id}/wide-image`, {
        headers: { "x-api-key": locals.apiKey }
    });

    if (!response.ok) error(404, "No wide art");

    return new Response(response.body, {
        headers: {
            "content-type": "image/webp",
            // By id, so not immutable: the art behind an id can change.
            "cache-control": "private, max-age=86400",
            "x-content-type-options": "nosniff"
        }
    });
};
