/**
 * Which sidebar entries a person has hidden.
 *
 * A per-user FRONTEND preference, so it lives in this database rather than in
 * the backend's settings -- the sidebar is this app's furniture, and the
 * television draws its own nav from the manifest regardless (see
 * `$lib/tv/manifest`). Same reasoning as `app_lock` next door.
 *
 * HIDDEN keys are stored, not visible ones, and that is the whole design.
 * Storing the visible set would mean every entry added by an update -- a new
 * page, a newly installed add-on -- is invisible to exactly the people who
 * have arranged their sidebar, in a way that looks like the update not having
 * landed. Storing the hidden set makes a new entry appear by default and
 * leaves the choices already made intact. It is the same rule
 * `$lib/rails.ts` follows for rows on a page, for the same reason.
 *
 * A key nothing offers today is kept rather than pruned: an add-on switched
 * off for an afternoon must not come back with its entry silently re-shown.
 */

import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./ba-auth";

export const navPrefs = sqliteTable("nav_prefs", {
    userId: text("user_id")
        .primaryKey()
        .references(() => user.id, { onDelete: "cascade" }),
    /**
     * The hidden entries' keys, as a JSON array. A host entry's key is its
     * `TvNavItem.key` ("library", "logs"); an add-on's is its href
     * ("/x/onlyfans"), which is the only stable identifier its nav entry
     * carries.
     */
    hidden: text("hidden", { mode: "json" })
        .$type<string[]>()
        .notNull()
        .default(sql`'[]'`)
});
