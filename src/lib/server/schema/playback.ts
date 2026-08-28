/**
 * Where each person got to in each item.
 *
 * Lives in the FRONTEND's database, not the backend's, on purpose. Resume
 * position is a per-user viewing fact, not a property of the library item --
 * the backend has no user table at all, so there is nowhere there to key it.
 * Keeping it here also means the backend schema stays identical to upstream
 * Riven's, which is what lets upstream migrations keep applying cleanly (see
 * MAINTAINING.md); a column added to `MediaItem` for this would be a
 * permanent divergence in the one place divergence is most expensive.
 *
 * Ticks, not seconds, because Jellyfin clients speak ticks (100ns units) and
 * they are the only consumer that cannot be changed. Storing what they send,
 * unconverted, keeps the lossy conversion at the one edge that needs it (the
 * web player) rather than on every read.
 */

import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { user } from "./ba-auth";

export const playbackProgress = sqliteTable(
    "playback_progress",
    {
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        /** Riven's own MediaItem id. Integer, matching the backend. */
        itemId: integer("item_id").notNull(),
        positionTicks: integer("position_ticks").notNull().default(0),
        /**
         * Total length, as reported by whoever wrote the position. Needed to
         * decide "finished" without a second lookup, and to render a progress
         * bar in a grid without fetching every item's media source.
         */
        runtimeTicks: integer("runtime_ticks"),
        /** Watched to the end. Sticky: rewinding a finished item does not clear it. */
        played: integer("played", { mode: "boolean" }).notNull().default(false),
        updatedAt: integer("updated_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull()
    },
    (table) => [
        primaryKey({ columns: [table.userId, table.itemId] }),
        // "Continue watching" is the only list query: newest first, per user.
        index("playback_progress_user_updated").on(table.userId, table.updatedAt)
    ]
);
