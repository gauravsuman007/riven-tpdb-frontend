/**
 * What a library title's page on riven-tv needs that the item record lacks:
 * the TPDB description, the cast in billing order, whether wide art exists,
 * and the IMDb rating.
 *
 * Plain data, the same sources as the app's own TPDB detail page
 * (`details/tpdb/[type]/[id]`), so the television and the browser agree about
 * who the lead is. Everything is optional: absence means "draw less", never
 * an error.
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { castOrder } from "$lib/cast-order";
import { getTitleExtras } from "$lib/title-extras";

type Json = Record<string, any>;

export const GET: RequestHandler = async ({ params, locals, fetch }) => {
    if (!locals.user) error(401, "Not signed in");

    const id = Number(params.itemId);

    if (!Number.isInteger(id) || id <= 0) error(404, "No such item");

    const headers = { "x-api-key": locals.apiKey };
    const get = async (path: string): Promise<Json | null> => {
        try {
            const response = await fetch(`${locals.backendUrl}${path}`, {
                headers,
                signal: AbortSignal.timeout(4000)
            });

            return response.ok ? ((await response.json()) as Json) : null;
        } catch {
            return null;
        }
    };

    const library = await get(`/api/v1/items/${id}?media_type=item`);
    const uuid = String(library?.tpdb_id ?? library?.parent_ids?.tpdb_id ?? "");

    if (!uuid) return json({ description: "", cast: [], wide: false, imdb: null });

    // A uuid names a scene or a movie and the library stores both as "movie";
    // ask for the kind it says, then the other.
    const kinds = library?.type === "movie" ? ["movies", "scenes"] : ["scenes", "movies"];
    const [first, extras] = await Promise.all([
        get(`/api/v1/tpdb/${kinds[0]}/${encodeURIComponent(uuid)}`),
        getTitleExtras(uuid, { baseUrl: locals.backendUrl, apiKey: locals.apiKey, fetch })
    ]);
    const record = first ?? (await get(`/api/v1/tpdb/${kinds[1]}/${encodeURIComponent(uuid)}`));

    const cast = record
        ? castOrder(record, extras?.cast_order ?? [])
              .map((performer) => String(performer?.name ?? ""))
              .filter(Boolean)
        : [];

    return json({
        description: String(record?.description ?? "").trim(),
        cast,
        wide: Boolean(extras?.wide),
        imdb:
            extras?.imdb_id && extras.imdb_rating
                ? { id: extras.imdb_id, rating: extras.imdb_rating, votes: extras.imdb_votes ?? 0 }
                : null
    });
};
