/**
 * Saved direct-scrape videos -- a source the user picked out from a search
 * and wants to keep, independent of whether the title has anything
 * downloaded or is even in the library at all.
 *
 * Lives in the FRONTEND's database for the same reason `playback.ts` does:
 * this is a per-user fact with no backend counterpart to attach it to (no
 * user table there, and a direct-scrape result is not a `MediaItem` --
 * nothing was added to the library). See that file's comment for the fuller
 * argument against pushing this into the backend schema instead.
 *
 * `contextTitle` is what scopes a bookmark to "this title's" search panel.
 * There is no library item id to key on that works in every case: a title
 * that has not been requested yet still gets a direct-scrape search, and
 * still needs bookmarking to work. The exact search title string is what
 * every caller already has in both cases, so it is what ties a bookmark back
 * to the page it was made from.
 */

import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { user } from "./ba-auth";

export const directVideoBookmark = sqliteTable(
    "direct_video_bookmark",
    {
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        /** Scraper key, e.g. "xfreehd". Matches `DirectVideo.site` on the backend. */
        site: text("site").notNull(),
        videoId: text("video_id").notNull(),
        contextTitle: text("context_title").notNull(),
        title: text("title").notNull(),
        pageUrl: text("page_url").notNull(),
        thumbnail: text("thumbnail"),
        /** Seconds. Rarely known from search alone -- most sites only reveal it on the video page. */
        duration: integer("duration"),
        /** e.g. "1080p". Filled in by the enrichment fetch when the search result didn't carry one. */
        resolution: text("resolution"),
        /** Bytes. Same as resolution -- usually only knowable once a source is resolved. */
        size: integer("size"),
        /**
         * Whether `resolution`/`size` still need fetching. "pending" right
         * after a bookmark is created (the search result rarely carries real
         * numbers), "ready" once the background enrichment call lands
         * (success OR a definitive "the site has none"), "failed" if that
         * call itself could not complete -- distinct from "ready" so a
         * transient failure can be retried instead of being read as "this
         * video genuinely has no metadata."
         */
        metadataStatus: text("metadata_status", { enum: ["pending", "ready", "failed"] })
            .notNull()
            .default("pending"),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull()
    },
    (table) => [
        primaryKey({ columns: [table.userId, table.site, table.videoId] }),
        // The only list query: every bookmark for this title's panel, newest first.
        index("direct_video_bookmark_user_context").on(
            table.userId,
            table.contextTitle,
            table.createdAt
        )
    ]
);
