/**
 * What a reported position MEANS, with no database in the way.
 *
 * Kept free of server imports for the same reason `cidr.ts` is: these rules
 * decide whether something counts as watched and whether it is worth
 * resuming, and a rule that is only ever exercised through a running player
 * is a rule that is not really tested.
 */

export const TICKS_PER_SECOND = 10_000_000;

/**
 * How close to the end still counts as finished.
 *
 * Credits, an outro, or simply stopping a little early should not leave an
 * item at 99% forever, offering a two-second resume next time. Jellyfin's own
 * server uses 90%, and matching it means the two agree about "watched"
 * instead of disagreeing per client.
 */
export const PLAYED_FRACTION = 0.9;

/**
 * Below this, treat it as never really started.
 *
 * Opening something, watching a few seconds and backing out should not put it
 * in Continue Watching -- that list is worthless if everything ever touched
 * is in it.
 */
export const MIN_RESUME_SECONDS = 15;

export type ProgressDecision =
    /** Store this position; the item is partially watched. */
    | { kind: "resume"; positionTicks: number; played: false }
    /** Watched to the end. Position resets so a replay starts at the start. */
    | { kind: "finished"; positionTicks: 0; played: true }
    /** Too early to matter: clear any stored position, keep any played mark. */
    | { kind: "discard" };

export function decideProgress(
    positionTicks: number,
    runtimeTicks: number | null
): ProgressDecision {
    const position = Math.max(0, Math.floor(positionTicks || 0));
    const runtime = runtimeTicks && runtimeTicks > 0 ? Math.floor(runtimeTicks) : null;

    if (runtime !== null && position >= runtime * PLAYED_FRACTION) {
        return { kind: "finished", positionTicks: 0, played: true };
    }

    if (position < MIN_RESUME_SECONDS * TICKS_PER_SECOND) {
        return { kind: "discard" };
    }

    return { kind: "resume", positionTicks: position, played: false };
}

/**
 * Whether a stored position can be applied to the file now loaded.
 *
 * A title's file can be replaced by a different release between sessions, so
 * a stored position is not necessarily inside the current file. Resuming past
 * the end would strand playback at a black frame.
 */
export function resumeTarget(
    positionSeconds: number,
    durationSeconds: number | undefined,
    endGuardSeconds = 5
): number | null {
    if (!(positionSeconds > 0) || !Number.isFinite(positionSeconds)) return null;

    if (durationSeconds !== undefined && Number.isFinite(durationSeconds)) {
        if (positionSeconds >= durationSeconds - endGuardSeconds) return null;
    }

    return positionSeconds;
}
