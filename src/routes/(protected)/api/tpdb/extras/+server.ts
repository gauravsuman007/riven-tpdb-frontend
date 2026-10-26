/**
 * IMDb ratings for a batch of titles, for the cards.
 *
 * Cache-only on the backend (see `getTitleExtrasBatch`): a title it has not
 * worked out yet is simply absent, and the backend fills it in the background
 * so the card's retry finds it. Only the rating leaves here -- a card needs
 * nothing else, and the rest of the extras can be large.
 */

import { json, error } from "@sveltejs/kit";
import { getTitleExtrasBatch } from "$lib/title-extras";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url, locals, fetch }) => {
    if (!locals.user) error(401, "Not signed in");

    const extras = await getTitleExtrasBatch(url.searchParams.getAll("ids"), {
        baseUrl: locals.backendUrl,
        apiKey: locals.apiKey,
        fetch
    });

    const ratings: Record<string, { rating: number; votes: number }> = {};

    for (const [uuid, entry] of Object.entries(extras)) {
        if (entry.imdb_rating)
            ratings[uuid] = { rating: entry.imdb_rating, votes: entry.imdb_votes ?? 0 };
    }

    return json(ratings, { headers: { "cache-control": "private, max-age=60" } });
};
