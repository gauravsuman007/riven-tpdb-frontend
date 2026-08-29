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
 * rendition's resolution/size.
 */
async function enrich(
    userId: string,
    site: string,
    videoId: string,
    backendUrl: string,
    apiKey: string
): Promise<void> {
    const existing = db
        .select({
            resolution: directVideoBookmark.resolution,
            size: directVideoBookmark.size
        })
        .from(directVideoBookmark)
        .where(
            and(
                eq(directVideoBookmark.userId, userId),
                eq(directVideoBookmark.site, site),
                eq(directVideoBookmark.videoId, videoId)
            )
        )
        .get();

    const result = await resolveBest(site, videoId, backendUrl, apiKey);

    db.update(directVideoBookmark)
        .set({
            // Merged, never overwritten wholesale. Several sites report a
            // resolution on the SEARCH card but not on the resolved source
            // (upornia is the clearest: search carries real dimensions, its
            // videofile API carries only a format name), so assigning the
            // resolve's value unconditionally would throw away a known-good
            // number and replace it with null -- the enrichment step making
            // the data worse than not running at all.
            resolution: result?.resolution ?? existing?.resolution ?? null,
            size: result?.size ?? existing?.size ?? null,
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

        let resolution: string | null = best.resolution ?? null;
        let size: number | null = best.size ?? null;

        // Most sites state neither. Measured across all eight: only two
        // report a resolution from the scraper and only one a size, because
        // the rest simply do not publish it anywhere a scraper can read --
        // the file itself is the only source of truth. Probing costs one
        // two-byte request and answers it for nearly all of them, so it is
        // worth doing whenever the scraper came up short.
        if (resolution === null || size === null) {
            const probed = await probeStream(site, videoId, backendUrl, apiKey);

            resolution ??= probed.resolution;
            size ??= probed.size;
        }

        return { resolution, size };
    } catch (err) {
        logger.debug(`resolve failed for ${site}:${videoId}`, err);
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Reads what the file itself says, for the sites that publish nothing a
 * scraper can parse.
 *
 * One `Range: bytes=0-1` request. The 206 response's `Content-Range` ends in
 * the total byte count, which is the real file size -- measured across all
 * eight sites, this recovers a size for seven of them, including every site
 * that reports none at all (xfreehd, fpoxxx, paradisehill, tnaflix,
 * noodlemagazine). Two bytes, so it costs essentially nothing and never
 * pulls the media itself.
 *
 * The eighth (iporntv) serves an HLS master playlist rather than a file, so
 * its "size" is the playlist's own 233 bytes and is meaningless -- but that
 * playlist body carries `RESOLUTION=854x480` on its stream-info line, which
 * is a real measurement of the video. Both cases are handled here: whichever
 * the response turns out to be, take the fact it actually offers.
 */
async function probeStream(
    site: string,
    videoId: string,
    backendUrl: string,
    apiKey: string
): Promise<ResolvedMeta> {
    const none: ResolvedMeta = { resolution: null, size: null };

    const controller = new AbortController();
    // Shorter than the resolve above: this is the optional half of an already
    // optional step, and the resolve has usually spent time by the time it
    // runs.
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
        const response = await fetch(
            `${backendUrl}/api/v1/direct/stream?site=${encodeURIComponent(site)}&video_id=${encodeURIComponent(videoId)}`,
            {
                // 0-1 rather than 0-0: a couple of CDNs answer a single-byte
                // range with 200 and the whole file, which would mean
                // downloading the media to read its length.
                headers: { "x-api-key": apiKey, Range: "bytes=0-1" },
                signal: controller.signal
            }
        );

        if (!response.ok) return none;

        const contentType = response.headers.get("content-type") ?? "";
        const isPlaylist =
            contentType.includes("mpegurl") || contentType.includes("x-mpegURL");

        if (isPlaylist) {
            // Re-fetched without a Range header: two bytes of a playlist is
            // not parseable, and a playlist is small enough that reading all
            // of it is cheaper than the request that asked for part of it.
            const full = await fetch(
                `${backendUrl}/api/v1/direct/stream?site=${encodeURIComponent(site)}&video_id=${encodeURIComponent(videoId)}`,
                { headers: { "x-api-key": apiKey }, signal: controller.signal }
            );

            if (!full.ok) return none;

            const body = await full.text();
            const match = body.match(/RESOLUTION=\d+x(\d+)/i);

            return match
                ? { resolution: `${match[1]}p`, size: null }
                : none;
        }

        // "bytes 0-1/821346051" -- the figure after the slash is the whole
        // file. "*" appears instead when the server will not state a length.
        const total = (response.headers.get("content-range") ?? "").split("/")[1];
        const parsed = Number(total);

        return Number.isFinite(parsed) && parsed > 0
            ? { resolution: null, size: parsed }
            : none;
    } catch (err) {
        logger.debug(`probe failed for ${site}:${videoId}`, err);
        return none;
    } finally {
        clearTimeout(timeout);
    }
}
