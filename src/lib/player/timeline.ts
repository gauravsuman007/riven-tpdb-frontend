/**
 * A title's files and where the viewer got to, as the browser reads them.
 *
 * The detail page and the player both need the same two answers a click
 * apart -- which files make up the title and how long each runs, and the
 * stored resume position -- so the answer is shared rather than fetched
 * twice. The parts route probes every file of a multi-file release on first
 * ask (about a second, cold); doing that once per page is the point.
 *
 * The rules for what the numbers mean live in `$lib/utils/parts`.
 */

import { partStarts, totalDuration } from "$lib/utils/parts";

export interface TitlePart {
    index: number;
    /** From the filename: "DEEPER 101336 1080P" is the only label a part has. */
    title: string;
    filename: string;
    file_size: number;
    duration: number | null;
}

export interface Timeline {
    parts: TitlePart[];
    /** Every file's size added up. */
    totalSize: number;
    /** Every file's length added up, or null if any is unknown. */
    totalDuration: number | null;
    /** Where each file begins in the whole title; null once unknowable. */
    starts: Array<number | null>;
}

export interface Progress {
    /** Seconds of the WHOLE title. */
    positionSeconds: number;
    played: boolean;
}

const EMPTY: Timeline = { parts: [], totalSize: 0, totalDuration: null, starts: [] };
const KEEP_MS = 60_000;

const timelines = new Map<number, { at: number; value: Promise<Timeline> }>();

/** The files of a title. Never rejects: no answer is an empty list. */
export function loadTimeline(itemId: number): Promise<Timeline> {
    const known = timelines.get(itemId);

    if (known && Date.now() - known.at < KEEP_MS) return known.value;

    const value = fetch(`/api/stream/${itemId}/parts`)
        .then((response) => (response.ok ? response.json() : null))
        .then((payload): Timeline => {
            const parts: TitlePart[] = Array.isArray(payload?.parts) ? payload.parts : [];

            if (!parts.length) return EMPTY;

            const durations = parts.map((part) => part.duration);

            return {
                parts,
                totalSize: parts.reduce((sum, part) => sum + (Number(part.file_size) || 0), 0),
                totalDuration: totalDuration(durations),
                starts: partStarts(durations)
            };
        })
        .catch(() => EMPTY);

    timelines.set(itemId, { at: Date.now(), value });

    // A failure is not worth remembering: the next look should try again.
    void value.then((timeline) => {
        if (!timeline.parts.length) timelines.delete(itemId);
    });

    return value;
}

/** Where this viewer stopped, or null. Always fresh: it changes as they watch. */
export async function loadProgress(itemId: number): Promise<Progress | null> {
    try {
        const response = await fetch(`/api/playback/progress?itemId=${itemId}`);

        if (!response.ok) return null;

        const body = await response.json();

        return {
            positionSeconds: Number(body?.positionSeconds) || 0,
            played: body?.played === true
        };
    } catch {
        return null;
    }
}
