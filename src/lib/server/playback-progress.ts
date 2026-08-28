/**
 * Resume positions, shared by every surface.
 *
 * The web player and the Jellyfin clients write through the same two
 * functions here, so "where was I" is one fact rather than one per app. That
 * is the whole point: a scene started in the browser resumes on the TV
 * because neither of them owns the number.
 *
 * Ticks are the unit throughout (100ns, Jellyfin's own), because the Jellyfin
 * clients are the participant whose wire format cannot be changed.
 */

import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "$lib/server/db";
import { playbackProgress } from "$lib/server/schema";
import { decideProgress } from "$lib/utils/playback";

export { TICKS_PER_SECOND } from "$lib/utils/playback";

export type Progress = {
    itemId: number;
    positionTicks: number;
    runtimeTicks: number | null;
    played: boolean;
    updatedAt: Date;
};

/** One item's position for one user, or null if there is none worth resuming. */
export function getProgress(userId: string, itemId: number): Progress | null {
    if (!userId || !Number.isInteger(itemId)) return null;

    const row = db
        .select()
        .from(playbackProgress)
        .where(and(eq(playbackProgress.userId, userId), eq(playbackProgress.itemId, itemId)))
        .get();

    return row ?? null;
}

/** Positions for many items at once, keyed by item id (for grids). */
export function getProgressMany(userId: string, itemIds: number[]): Map<number, Progress> {
    const wanted = itemIds.filter((id) => Number.isInteger(id));

    if (!userId || wanted.length === 0) return new Map();

    const rows = db
        .select()
        .from(playbackProgress)
        .where(and(eq(playbackProgress.userId, userId), inArray(playbackProgress.itemId, wanted)))
        .all();

    return new Map(rows.map((row) => [row.itemId, row]));
}

/** Most recently watched, still unfinished. The "Continue watching" row. */
export function getContinueWatching(userId: string, limit = 20): Progress[] {
    if (!userId) return [];

    return db
        .select()
        .from(playbackProgress)
        .where(
            and(
                eq(playbackProgress.userId, userId),
                eq(playbackProgress.played, false),
                gt(playbackProgress.positionTicks, 0)
            )
        )
        .orderBy(desc(playbackProgress.updatedAt))
        .limit(limit)
        .all();
}

/**
 * Record where someone got to.
 *
 * `played` is sticky on purpose -- once something is finished, scrubbing back
 * through it does not un-finish it. Clients report a position of 0 at the
 * moment playback starts, and treating that as "unwatched" would erase the
 * mark every time a finished item was replayed.
 */
export function setProgress(
    userId: string,
    itemId: number,
    positionTicks: number,
    runtimeTicks?: number | null
): void {
    if (!userId || !Number.isInteger(itemId) || itemId <= 0) return;

    const decision = decideProgress(positionTicks, runtimeTicks ?? null);
    const runtime = runtimeTicks && runtimeTicks > 0 ? Math.floor(runtimeTicks) : null;

    // Not worth resuming. Drop any stored position, but leave a `played` mark
    // alone -- replaying a finished item reports position 0 at the moment it
    // starts, and treating that as "unwatched" would erase the mark every
    // time.
    if (decision.kind === "discard") {
        const existing = getProgress(userId, itemId);

        if (!existing) return;

        db.update(playbackProgress)
            .set({ positionTicks: 0, runtimeTicks: runtime ?? existing.runtimeTicks })
            .where(and(eq(playbackProgress.userId, userId), eq(playbackProgress.itemId, itemId)))
            .run();

        return;
    }

    db.insert(playbackProgress)
        .values({
            userId,
            itemId,
            positionTicks: decision.positionTicks,
            runtimeTicks: runtime,
            played: decision.played,
            updatedAt: new Date()
        })
        .onConflictDoUpdate({
            target: [playbackProgress.userId, playbackProgress.itemId],
            set: {
                positionTicks: decision.positionTicks,
                runtimeTicks: runtime,
                // Sticky: only ever set, never cleared here.
                played: decision.played ? true : undefined,
                updatedAt: new Date()
            }
        })
        .run();
}

/** Forget an item entirely (an explicit "mark as unwatched"). */
export function clearProgress(userId: string, itemId: number): void {
    if (!userId || !Number.isInteger(itemId)) return;

    db.delete(playbackProgress)
        .where(and(eq(playbackProgress.userId, userId), eq(playbackProgress.itemId, itemId)))
        .run();
}

/** Explicitly mark watched / unwatched, independent of any position. */
export function setPlayed(userId: string, itemId: number, played: boolean): void {
    if (!userId || !Number.isInteger(itemId) || itemId <= 0) return;

    if (!played) {
        clearProgress(userId, itemId);
        return;
    }

    db.insert(playbackProgress)
        .values({ userId, itemId, positionTicks: 0, played: true, updatedAt: new Date() })
        .onConflictDoUpdate({
            target: [playbackProgress.userId, playbackProgress.itemId],
            set: { positionTicks: 0, played: true, updatedAt: new Date() }
        })
        .run();
}
