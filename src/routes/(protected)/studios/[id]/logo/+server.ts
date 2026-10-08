/**
 * One studio's logo, from the cache on the data volume.
 * See `$lib/server/studio-logos` for why and for what it will not fetch.
 */

import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getStudio } from "$lib/studios";
import { studioLogo } from "$lib/server/studio-logos";

export const GET: RequestHandler = async ({ params, locals, fetch }) => {
    if (!locals.user) error(401, "Not signed in");

    const id = Number(params.id);

    if (!Number.isInteger(id) || id <= 0) error(404, "No such studio");

    const studio = await getStudio(id, {
        baseUrl: locals.backendUrl,
        apiKey: locals.apiKey,
        fetch
    });

    const logo = await studioLogo(id, studio?.logo_path ?? null, fetch);

    if (!logo) error(404, "No logo");

    return new Response(new Uint8Array(logo.body), {
        headers: {
            "content-type": logo.type,
            // The page asks with ?v=<hash of the logo's URL>, so a changed
            // logo is a different URL and this one never goes stale.
            "cache-control": "public, max-age=31536000, immutable",
            // An SVG served from our own origin must not be able to run script.
            "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
            "x-content-type-options": "nosniff"
        }
    });
};
