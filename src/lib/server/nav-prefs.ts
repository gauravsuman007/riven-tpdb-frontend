/**
 * Reading and writing which sidebar entries a person has hidden.
 *
 * See `schema/nav-prefs.ts` for why the HIDDEN set is what is stored.
 */

import { eq } from "drizzle-orm";

import { db } from "./db";
import { navPrefs } from "./schema";
import { ALWAYS_SHOWN } from "$lib/nav";

/** The keys this user has hidden. Empty for a user who has never chosen. */
export function getHiddenNav(userId: string): string[] {
    const row = db.select().from(navPrefs).where(eq(navPrefs.userId, userId)).get();

    // A hand-edited or half-migrated row must not take the sidebar with it:
    // anything that is not an array of strings reads as "nothing hidden".
    if (!row || !Array.isArray(row.hidden)) return [];

    return row.hidden.filter((key): key is string => typeof key === "string");
}

/**
 * Replace the hidden set.
 *
 * Home and Settings are stripped here rather than trusted to the UI. Settings
 * is the only route back to the control that edits this list, so accepting a
 * request that hides it would let one malformed POST leave the sidebar with
 * no way to repair itself.
 */
export function setHiddenNav(userId: string, hidden: string[]): string[] {
    const cleaned = [
        ...new Set(
            hidden
                .filter((key) => typeof key === "string" && key.length > 0 && key.length <= 200)
                .filter((key) => !ALWAYS_SHOWN.has(key))
        )
    ];

    db.insert(navPrefs)
        .values({ userId, hidden: cleaned })
        .onConflictDoUpdate({ target: navPrefs.userId, set: { hidden: cleaned } })
        .run();

    return cleaned;
}
