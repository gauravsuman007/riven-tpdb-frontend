/**
 * A multi-file release as ONE timeline.
 *
 * A scene compilation is one torrent of several files, and every surface
 * treats it as one title: one seek bar, one total running time, one resume
 * point. Positions are stored and passed as seconds of the WHOLE title -- the
 * resume store, the up-next cards, riven-tv's `?at=` -- and only the player
 * knows which file a second falls in. This is where that is decided.
 *
 * Why the whole title and not "file 3, 12:40": the resume store holds one
 * number per item and decides "watched" at 90% of the reported duration
 * (`decideProgress`). Reporting a file's own position against that file's
 * length marked a five-file title as watched the moment its FIRST file
 * finished, and resumed every file at the same second.
 *
 * riven-tv carries the same rule in its player script (`locate` there); the
 * two must agree, or a title resumed on the television lands somewhere else
 * in the browser.
 *
 * Free of imports for the same reason `playback.ts` is.
 */

/** Seconds of each file; null or 0 where nobody knows yet. */
export type Durations = ReadonlyArray<number | null | undefined>;

function lengthOf(value: number | null | undefined): number {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/** The whole title's running time, or null if any file's length is unknown. */
export function totalDuration(durations: Durations): number | null {
    if (durations.length === 0) return null;

    let total = 0;

    for (const value of durations) {
        const length = lengthOf(value);
        if (!length) return null;
        total += length;
    }

    return total;
}

/**
 * Where each file begins, in seconds of the whole title. Null from the first
 * file after an unknown length on: its start would be a guess.
 */
export function partStarts(durations: Durations): Array<number | null> {
    const starts: Array<number | null> = [];
    let from: number | null = 0;

    for (const value of durations) {
        starts.push(from);
        const length = lengthOf(value);
        from = from !== null && length ? from + length : null;
    }

    return starts;
}

/**
 * Which file a second of the whole title falls in, and how far into it.
 *
 * A boundary belongs to the file that starts there. Past an unknown length
 * nothing can be placed further, so the position stays in that file.
 */
export function locate(durations: Durations, at: number): { part: number; local: number } {
    const target = Number.isFinite(at) && at > 0 ? at : 0;
    let start = 0;

    for (let part = 0; part < durations.length; part += 1) {
        const length = lengthOf(durations[part]);

        if (!length || target < start + length || part === durations.length - 1) {
            return { part, local: Math.max(0, target - start) };
        }

        start += length;
    }

    return { part: 0, local: 0 };
}
