/**
 * The signed-in viewer's "Up next" cards, for riven-tv's home screen.
 *
 * The choosing is `$lib/server/up-next`, which this app's own home hero also
 * calls, so the television draws the same answer rather than a copy of the
 * rules that would drift. Plain data out: what to draw and why, where to
 * resume. The television decides how it looks.
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { loadUpNext } from "$lib/server/up-next";

export const GET: RequestHandler = async ({ url, locals, fetch }) => {
    const userId = locals.user?.id;

    if (!userId) error(401, "Not signed in");

    const limit = Math.max(1, Math.min(10, Number(url.searchParams.get("limit")) || 5));
    const cards = await loadUpNext(
        userId,
        { backendUrl: locals.backendUrl, apiKey: locals.apiKey, fetch },
        { limit }
    );

    return json({
        items: cards.map((card) => ({
            itemId: Number(card.item.id),
            title: card.item.title ?? "",
            poster_path: card.item.poster_path ?? null,
            tpdb_id: card.item.tpdb_id ?? card.item.parent_ids?.tpdb_id ?? null,
            aired_at: card.item.aired_at ?? null,
            reason: card.reason,
            detail: card.detail,
            progress: card.progress ?? null,
            resumeAt: card.resumeAt ?? null
        }))
    });
};
