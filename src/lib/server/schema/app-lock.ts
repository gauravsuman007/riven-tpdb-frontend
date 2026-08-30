/**
 * A short PIN that blanks the app after a period of inactivity.
 *
 * WHAT THIS IS, AND IS NOT. It is a lockscreen, in the sense a phone has one:
 * it stops whoever picks up an already-signed-in device from reading what is
 * on it. It is NOT a second authentication factor. The person it guards
 * against is holding a browser that already has a valid session cookie, so
 * anyone determined enough to open devtools is past it. Four digits could not
 * be an auth boundary anyway.
 *
 * That is exactly why it is worth building well within its scope and worth
 * being honest about outside it: the lock is enforced on the SERVER, so a
 * locked page never sends the content it is hiding, and the PIN is stored
 * hashed so the database does not leak it.
 *
 * `lastActiveAt` is deliberately NOT "the time of the last request". Riven's
 * pages poll -- the dashboard, the event stream, playback progress -- so a
 * request-based clock would never run down and the lock would never engage.
 * It is updated only by an explicit beacon meaning a person did something, or
 * a video advanced.
 */

import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { user } from "./ba-auth";

export const appLock = sqliteTable("app_lock", {
    userId: text("user_id")
        .primaryKey()
        .references(() => user.id, { onDelete: "cascade" }),
    /**
     * scrypt hash of the PIN, or null when no PIN has been set.
     *
     * Hashed despite being four digits and trivially brute-forced offline.
     * The point is not that the hash is strong -- it cannot be -- but that a
     * casual read of the database, a backup or a log does not hand over the
     * code someone types in front of other people.
     */
    pinHash: text("pin_hash"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    /*
        Which surfaces the lock covers. Separate, because they protect
        different things and the common case wants only the first.

        `lockFrontend` is the screen lock: the UI and this app's own routes.
        `lockBackend` additionally refuses the browser's proxied calls to the
        Riven backend API (`/api/v1/...` via the backendProxy route).

        Defaults match the ordinary intent -- hide what is on screen, without
        cutting off the API. Turning the backend one on is the stricter
        choice, and it is off by default because a locked API breaks anything
        else driving this frontend from the same browser.
    */
    lockFrontend: integer("lock_frontend", { mode: "boolean" }).notNull().default(true),
    lockBackend: integer("lock_backend", { mode: "boolean" }).notNull().default(false),
    /** Minutes of inactivity before locking. */
    timeoutMinutes: integer("timeout_minutes").notNull().default(10),
    /**
     * Last time a PERSON did something, or playback advanced. Never touched
     * by ordinary page loads or polling -- see the note above.
     */
    lastActiveAt: integer("last_active_at", { mode: "timestamp_ms" })
        .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
        .notNull()
});
