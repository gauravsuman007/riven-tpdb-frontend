/**
 * Saved direct-scrape videos: list, add, remove, and the background fetch
 * that fills in resolution/size after the fact.
 *
 * A search result almost never carries real resolution/size -- most sites
 * only reveal that on the video page itself, which is exactly what
 * `/direct/sources` resolves. Doing that resolve INSIDE the bookmark POST
 * would make "save this" wait on a live request to someone else's server;
 * instead the row saves immediately as "pending" and this fires the resolve
 * afterward, in the same process, without the client waiting on it. Safe
 * here specifically because this runs as a persistent Node process (the
 * adapter-node deployment this app actually uses), not a serverless
 * function that could be frozen the instant the response is sent.
 */

import { and, desc, eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { directVideoBookmark } from "$lib/server/schema";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("bookmarks");

export type Bookmark = typeof directVideoBookmark.$inferSelect;

export function getBookmarks(userId: string, contextTitle: string): Bookmark[] {
    if (!userId || !contextTitle) return [];

    return db
        .select()
        .from(directVideoBookmark)
        .where(
            and(
                eq(directVideoBookmark.userId, userId),
                eq(directVideoBookmark.contextTitle, contextTitle)
            )
        )
        .orderBy(desc(directVideoBookmark.createdAt))
        .all();
}

export function isBookmarked(userId: string, site: string, videoId: string): boolean {
    if (!userId) return false;

    const row = db
        .select({ site: directVideoBookmark.site })
        .from(directVideoBookmark)
        .where(
            and(
                eq(directVideoBookmark.userId, userId),
                eq(directVideoBookmark.site, site),
                eq(directVideoBookmark.videoId, videoId)
            )
        )
        .get();

    return row !== undefined;
}

export interface NewBookmark {
    site: string;
    videoId: string;
    contextTitle: string;
    title: string;
    pageUrl: string;
    thumbnail: string | null;
    duration: number | null;
    resolution: string | null;
    size: number | null;
}

/**
 * Saves the bookmark and returns immediately. If the search result already
 * carried a resolution and size (rare, but a few sites do report it up
 * front), there is nothing to enrich and the row is marked "ready" as-is --
 * firing a resolve call that would just confirm what is already known is a
 * live request to someone else's server for no reason.
 */
export function addBookmark(
    userId: string,
    entry: NewBookmark,
    backendUrl: string,
    apiKey: string
): Bookmark {
    const alreadyKnown = entry.resolution !== null && entry.size !== null;

    const row = db
        .insert(directVideoBookmark)
        .values({
            userId,
            site: entry.site,
            videoId: entry.videoId,
            contextTitle: entry.contextTitle,
            title: entry.title,
            pageUrl: entry.pageUrl,
            thumbnail: entry.thumbnail,
            duration: entry.duration,
            resolution: entry.resolution,
            size: entry.size,
            metadataStatus: alreadyKnown ? "ready" : "pending"
        })
        .onConflictDoUpdate({
            target: [directVideoBookmark.userId, directVideoBookmark.site, directVideoBookmark.videoId],
            set: {
                contextTitle: entry.contextTitle,
                title: entry.title,
                pageUrl: entry.pageUrl,
                thumbnail: entry.thumbnail
            }
        })
        .returning()
        .get();

    if (!alreadyKnown) {
        // Deliberately not awaited -- see the module comment.
        enrich(userId, entry.site, entry.videoId, backendUrl, apiKey).catch((err) => {
            logger.error(`enrichment failed for ${entry.site}:${entry.videoId}`, err);
        });
    }

    return row;
}

export function removeBookmark(userId: string, site: string, videoId: string): void {
    if (!userId) return;

    db.delete(directVideoBookmark)
        .where(
            and(
                eq(directVideoBookmark.userId, userId),
                eq(directVideoBookmark.site, site),
                eq(directVideoBookmark.videoId, videoId)
            )
        )
        .run();
}

/**
 * Resolves the video's real sources on the backend and stores the best
 * rendition's resolution/size. Exported so a caller that already has a live
 * player open (which needs the same numbers right away, not on the next page
 * load) can call it directly instead of waiting on this same background path
 * -- see `enrichForPlayer` below.
 */
async function enrich(
    userId: string,
    site: string,
    videoId: string,
    backendUrl: string,
    apiKey: string
): Promise<void> {
    const result = await resolveBest(site, videoId, backendUrl, apiKey);

    db.update(directVideoBookmark)
        .set({
            resolution: result?.resolution ?? null,
            size: result?.size ?? null,
            metadataStatus: result ? "ready" : "failed"
        })
        .where(
            and(
                eq(directVideoBookmark.userId, userId),
                eq(directVideoBookmark.site, site),
                eq(directVideoBookmark.videoId, videoId)
            )
        )
        .run();
}

export interface ResolvedMeta {
    resolution: string | null;
    size: number | null;
}

/**
 * The actual backend call, factored out so both the bookmark-save path and
 * the player (which wants the same numbers for a video it is not
 * necessarily bookmarking) can use it without duplicating the fetch.
 *
 * Timed out deliberately short: this is enrichment, not the thing standing
 * between the user and playback, which already started by the time this
 * runs. A slow or dead site should not be allowed to hang the fetch
 * indefinitely just because someone happened to bookmark from it.
 */
export async function resolveBest(
    site: string,
    videoId: string,
    backendUrl: string,
    apiKey: string
): Promise<ResolvedMeta | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
        const response = await fetch(
            `${backendUrl}/api/v1/direct/sources?site=${encodeURIComponent(site)}&video_id=${encodeURIComponent(videoId)}`,
            { headers: { "x-api-key": apiKey }, signal: controller.signal }
        );

        if (!response.ok) return null;

        const data = await response.json();
        const best = data?.sources?.[0];

        if (!best) return null;

        return {
            resolution: best.resolution ?? null,
            size: best.size ?? null
        };
    } catch (err) {
        logger.debug(`resolve failed for ${site}:${videoId}`, err);
        return null;
    } finally {
        clearTimeout(timeout);
    }
}
