/**
 * One cast member's headshot, from the cache on the data volume.
 * See `$lib/server/performer-faces` for the size it is stored at and for
 * which hosts it will fetch from.
 */

import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { isAllowedFace, performerFace } from "$lib/server/performer-faces";

export const GET: RequestHandler = async ({ url, locals, fetch }) => {
    if (!locals.user) error(401, "Not signed in");

    const source = url.searchParams.get("u") ?? "";

    if (!isAllowedFace(source)) error(404, "No such face");

    const face = await performerFace(source, fetch);

    if (!face) error(404, "No face");

    return new Response(new Uint8Array(face), {
        headers: {
            "content-type": "image/webp",
            // Keyed by the source URL, so a changed picture is a new address.
            "cache-control": "public, max-age=31536000, immutable",
            "x-content-type-options": "nosniff"
        }
    });
};
