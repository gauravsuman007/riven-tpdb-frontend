/*
    What the sidebar offers, and which of it a person has hidden.

    Shared by the sidebar, the settings control that edits the list and the
    server route that stores it, so all three agree on the keys and on what
    cannot be turned off.
*/

import type { AddonNav } from "$lib/addons";
import { NAV_ITEMS } from "$lib/tv/manifest";

/** One entry the sidebar can show, in the vocabulary the preference stores. */
export interface NavEntry {
    /**
     * Stable across releases: it is what the preference stores. A host
     * entry's is its manifest key; an add-on's is its href, the only stable
     * identifier its nav entry carries.
     */
    key: string;
    label: string;
    /** Whether the entry may be hidden at all. */
    lockable: boolean;
}

/*
    Home and Settings can never be hidden.

    Not a nicety: Settings is the only way back to this control, so hiding it
    would leave the sidebar unrecoverable from the UI, and Home is where the
    back button and the app's own redirects land. Enforced on the SERVER as
    well as here -- see `$lib/server/nav-prefs.ts` -- because a checkbox is
    not an enforcement point.
*/
export const ALWAYS_SHOWN = new Set(["home", "settings"]);

/** Everything the sidebar can offer this session, hidden or not. */
export function navCatalogue(addons: AddonNav[] = []): NavEntry[] {
    return [
        ...NAV_ITEMS.map((item) => ({
            key: item.key,
            label: item.label,
            lockable: !ALWAYS_SHOWN.has(item.key)
        })),
        ...addons.map((addon) => ({
            key: addon.href,
            label: addon.label,
            lockable: true
        }))
    ];
}
