/**
 * Horizontal swipe-to-seek, with the seek distance driven by swipe momentum.
 *
 * A fixed pixels-to-seconds ratio makes long jumps painful on a phone: seeking
 * ten minutes into a two-hour film would take several full-width drags. Tying
 * the ratio to velocity gives one gesture two useful modes -- drag slowly to
 * nudge a few seconds, flick to cross minutes -- without a mode switch.
 *
 * Kept separate from the component so the curve can be tested. Getting it wrong
 * is the difference between "precise" and "unusable", and that is not something
 * to discover by hand on a phone.
 */

/** Seconds of video per pixel of travel at rest, before any velocity gain. */
export const BASE_SECONDS_PER_PX = 0.08;

/**
 * Velocity, in px/ms, at which the gain has doubled.
 *
 * A relaxed drag runs about 0.3 px/ms and a deliberate flick 2-4, so this puts
 * the interesting part of the curve inside the range fingers actually produce.
 */
export const VELOCITY_REFERENCE = 1.5;

/** Ceiling on the gain, so a violent flick cannot throw the position away. */
export const MAX_GAIN = 6;

/** Travel, in px, before a horizontal drag is treated as a seek at all. */
export const SEEK_THRESHOLD_PX = 12;

/** Below this the release is a stop, not a flick, and no momentum is added. */
export const FLING_MIN_VELOCITY = 0.4;

/** How much of the fling velocity converts to extra travel, in ms of glide. */
export const FLING_GLIDE_MS = 260;

export interface Sample {
    x: number;
    /** Timestamp in ms; any monotonic clock will do. */
    t: number;
}

/**
 * Instantaneous gain applied to a movement, from how fast it is happening.
 *
 * Rises smoothly from 1 so slow movement stays frame-accurate, then saturates
 * so the fastest possible flick is still bounded.
 */
export function velocityGain(velocity: number): number {
    const speed = Math.abs(velocity);

    if (!Number.isFinite(speed)) return 1;

    return Math.min(1 + speed / VELOCITY_REFERENCE, MAX_GAIN);
}

/**
 * Velocity in px/ms between two samples.
 *
 * Returns 0 rather than Infinity when two samples share a timestamp, which
 * happens whenever coalesced pointer events are delivered in one batch.
 */
export function velocityBetween(from: Sample, to: Sample): number {
    const dt = to.t - from.t;

    if (!(dt > 0)) return 0;

    return (to.x - from.x) / dt;
}

/**
 * Seconds to seek for one movement step.
 *
 * Called per pointermove and accumulated, so the gain tracks how the speed
 * changes *during* the gesture: slowing down at the end of a flick lands the
 * last few pixels precisely instead of overshooting.
 */
export function seekDelta(dx: number, velocity: number): number {
    if (!Number.isFinite(dx)) return 0;

    return dx * BASE_SECONDS_PER_PX * velocityGain(velocity);
}

/**
 * Extra seconds contributed by releasing at speed.
 *
 * Modelled as a short glide at the release velocity rather than a decaying
 * animation: the seek is committed once, on release, so a fling that kept
 * animating would leave the video chasing a target the viewer can no longer
 * influence.
 */
export function flingBonus(velocity: number): number {
    if (!Number.isFinite(velocity) || Math.abs(velocity) < FLING_MIN_VELOCITY) return 0;

    return seekDelta(velocity * FLING_GLIDE_MS, velocity);
}

/** Keep only the samples inside `windowMs` of the newest one. */
export function recentSamples(samples: Sample[], windowMs = 100): Sample[] {
    if (!samples.length) return [];

    const newest = samples[samples.length - 1].t;

    return samples.filter((sample) => newest - sample.t <= windowMs);
}

/**
 * Release velocity, averaged over the tail of the gesture.
 *
 * A single last pair is far too noisy -- fingers stutter as they lift, and one
 * unlucky pair can report a fling in the wrong direction.
 */
export function releaseVelocity(samples: Sample[], windowMs = 100): number {
    const recent = recentSamples(samples, windowMs);

    if (recent.length < 2) return 0;

    return velocityBetween(recent[0], recent[recent.length - 1]);
}

/** Clamp a seek target into the media's real range. */
export function clampTime(time: number, duration: number): number {
    if (!Number.isFinite(time)) return 0;
    if (!Number.isFinite(duration) || duration <= 0) return Math.max(0, time);

    return Math.min(Math.max(time, 0), duration);
}

/** "+1:23" / "-0:45", for the on-screen indicator during a swipe. */
export function formatOffset(seconds: number): string {
    const sign = seconds < 0 ? "-" : "+";
    const total = Math.round(Math.abs(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    if (hours) {
        return `${sign}${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    return `${sign}${minutes}:${String(secs).padStart(2, "0")}`;
}

/** "1:23:45" / "4:05", for the absolute position readout. */
export function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

    const total = Math.floor(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    if (hours) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    return `${minutes}:${String(secs).padStart(2, "0")}`;
}
