/**
 * A wide image (TMDB backdrop or TPDB scene still), from the backend's TPDB
 * cache at 1280px WebP. See `program/apis/tpdb_images.py` in the backend.
 */

import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url, locals, fetch }) => {
    if (!locals.user) error(401, "Not signed in");

    const source = url.searchParams.get("u");

    if (!source) error(404, "No such image");

    const response = await fetch(
        `${locals.backendUrl}/api/v1/tpdb/wide-image?url=${encodeURIComponent(source)}`,
        { headers: { "x-api-key": locals.apiKey } }
    );

    if (!response.ok) error(404, "No image");

    return new Response(response.body, {
        headers: {
            "content-type": "image/webp",
            // Keyed by the source URL, so a changed image is a new address.
            "cache-control": "public, max-age=31536000, immutable",
            "x-content-type-options": "nosniff"
        }
    });
};
