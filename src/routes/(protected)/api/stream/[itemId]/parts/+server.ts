import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { totalDuration } from "$lib/utils/parts";

/**
 * The playable files of one title, in playing order.
 *
 * A scene compilation is one torrent holding five or six separate scenes.
 * Every title answers here, single-file ones with a one-entry list, so the
 * player has one shape to handle rather than a special case.
 *
 * DURATIONS ARE FILLED IN HERE. The backend deliberately does not probe to
 * build the list (six remote ffprobes before a player could draw anything),
 * so `duration` is usually null -- and a multi-file title then has no total
 * running time, no seek bar across its files and no way to place a resume
 * point in the right file. So for a multi-file title each unknown length is
 * probed through `playback_info?part=N`, all at once, and remembered for ten
 * minutes: the detail page pays for it and the player, a click later, does
 * not. A single file is never probed here; its player probes it anyway.
 *
 * `total_size` and `total_duration` are the whole release. `total_duration`
 * is null unless every file's length is known -- a sum missing a file is a
 * number that is confidently wrong.
 */

interface Part {
    index: number;
    title: string;
    filename: string;
    file_size: number;
    duration: number | null;
}

const TTL_MS = 10 * 60_000;
const PROBE_TIMEOUT_MS = 8_000;
const MAX_PROBED = 40;

/** Keyed by item, part and file size, so a replaced release is probed again. */
const probed = new Map<string, { at: number; seconds: number }>();

async function probeLength(
    fetcher: typeof fetch,
    backendUrl: string,
    apiKey: string,
    itemId: string,
    part: Part
): Promise<number | null> {
    const key = `${itemId}:${part.index}:${part.file_size}`;
    const known = probed.get(key);

    if (known && Date.now() - known.at < TTL_MS) return known.seconds;

    try {
        const response = await fetcher(
            `${backendUrl}/api/v1/stream/playback_info/${itemId}${part.index > 0 ? `?part=${part.index}` : ""}`,
            { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) }
        );

        if (!response.ok) return null;

        const seconds = Number((await response.json())?.probe?.duration);

        if (!(seconds > 0)) return null;

        if (probed.size > 2000) probed.clear();
        probed.set(key, { at: Date.now(), seconds });

        return seconds;
    } catch {
        return null;
    }
}

export const GET: RequestHandler = async ({ params, locals, fetch }) => {
    const { itemId } = params;

    if (!itemId || isNaN(Number(itemId))) {
        error(400, "Invalid item ID");
    }

    const empty = {
        item_id: Number(itemId),
        title: "",
        parts: [],
        total_size: 0,
        total_duration: null
    };

    try {
        const response = await fetch(`${locals.backendUrl}/api/v1/stream/parts/${itemId}`, {
            headers: { "x-api-key": locals.apiKey }
        });

        if (!response.ok) {
            // Degraded rather than fatal: a player that cannot get the part
            // list falls back to playing part 0, which is what it did before
            // playlists existed.
            return json(empty);
        }

        const payload = (await response.json()) as {
            item_id: number;
            title: string;
            parts?: Part[];
        };
        const parts: Part[] = Array.isArray(payload.parts) ? payload.parts : [];

        if (parts.length > 1) {
            const lengths = await Promise.all(
                parts.map((part, at) =>
                    part.duration && part.duration > 0
                        ? Promise.resolve(part.duration)
                        : at < MAX_PROBED
                          ? probeLength(fetch, locals.backendUrl, locals.apiKey, itemId, part)
                          : Promise.resolve(null)
                )
            );

            parts.forEach((part, at) => (part.duration = lengths[at] ?? null));
        }

        return json({
            ...payload,
            parts,
            total_size: parts.reduce((sum, part) => sum + (Number(part.file_size) || 0), 0),
            total_duration: totalDuration(parts.map((part) => part.duration))
        });
    } catch (e) {
        console.error("Media parts lookup failed:", e);
        return json(empty);
    }
};
