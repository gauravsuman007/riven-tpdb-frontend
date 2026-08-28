/**
 * The web player's end of resume tracking.
 *
 * Deliberately the same store the Jellyfin clients write to via
 * `/Sessions/Playing/*` -- that is what makes a scene started in a browser
 * resume on the TV. The only difference is the unit at the edge: the browser
 * speaks seconds (`HTMLMediaElement.currentTime`), so the conversion to ticks
 * happens here rather than being pushed into the player component.
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
    TICKS_PER_SECOND,
    getProgress,
    setPlayed,
    setProgress
} from "$lib/server/playback-progress";

function requireUser(locals: App.Locals): string {
    const id = locals.user?.id;
    if (!id) error(401, "Not signed in");
    return id;
}

export const GET: RequestHandler = async ({ url, locals }) => {
    const userId = requireUser(locals);
    const itemId = Number(url.searchParams.get("itemId"));

    if (!Number.isInteger(itemId) || itemId <= 0) error(400, "itemId is required");

    const progress = getProgress(userId, itemId);

    return json({
        positionSeconds: progress ? progress.positionTicks / TICKS_PER_SECOND : 0,
        played: progress?.played ?? false
    });
};

export const POST: RequestHandler = async ({ request, locals }) => {
    const userId = requireUser(locals);
    const body = await request.json().catch(() => null);

    if (!body) error(400, "Expected a JSON body");

    const itemId = Number(body.itemId);

    if (!Number.isInteger(itemId) || itemId <= 0) error(400, "itemId is required");

    if (typeof body.played === "boolean") {
        setPlayed(userId, itemId, body.played);
        return json({ ok: true });
    }

    setProgress(
        userId,
        itemId,
        Math.round(Number(body.positionSeconds || 0) * TICKS_PER_SECOND),
        body.durationSeconds ? Math.round(Number(body.durationSeconds) * TICKS_PER_SECOND) : null
    );

    return json({ ok: true });
};
