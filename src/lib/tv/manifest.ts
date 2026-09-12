/*
    The shell, as data.

    `riven-tv` is a second renderer over this app's API. It has to be: the
    target is an LG C9, so Chromium 53, where this app's own bundle cannot
    run at all -- dynamic `import()` is 63 and the stylesheet uses `oklch()`,
    `@layer` and grid, every one of which that engine discards in silence.

    Two renderers drift. A row added here used to be a row missing there
    until somebody remembered to add it twice, and the failure was quiet:
    the television simply did not have it, and nobody found out until they
    switched the set on.

    So the shell is described here, once, and BOTH surfaces render from this
    list -- the home page below via `MediaListStore`, the television via
    `/api/tv/shell`. Adding, removing, retitling or reordering a row is an
    edit to this file and nothing else.

    A NEW FILE, deliberately. See MAINTAINING.md rule 5: added files cannot
    conflict with upstream, and the two files that import this one have no
    upstream history since the merge base, so both edits are free.
*/

import type { Pathname } from "$app/types";

/** A row on the home page. */
export interface TvRow {
    /** Cache key for `MediaListStore`, and the `{#each}` key. Must be stable. */
    key: string;
    title: string;
    /** A path on THIS app returning the row's items. */
    endpoint: Pathname;
    /** Where "View All" goes, or null for no pill. */
    viewAll: Pathname | null;
    /**
     * Skip the five-minute client cache. For a feed that changes under the
     * viewer -- the library does, the TPDB listings do not.
     */
    noCache?: boolean;
    /**
     * Show this row on the television.
     *
     * Not every row belongs there: the television has no way to request a
     * title (no write path to the backend, on purpose), so a row of things
     * it can only look at is worth less on that surface than on this one.
     * Set it false rather than deleting the row.
     */
    tv: boolean;
}

/*
    TPDB has no trending window -- its ordering parameters are ignored
    upstream -- so the last two are newest-first feeds with no day/week
    toggle, which is why none of these rows carries a time window.
*/
export const HOME_ROWS: TvRow[] = [
    {
        key: "recentlyAdded",
        title: "Recently Added",
        endpoint: "/api/library/recent",
        // No pill: this row is the top of the library, and a "View All" on
        // it would be a second way to the page the nav already offers.
        viewAll: null,
        // The store fetches this itself on mount, so the server load no
        // longer blocks first paint on a library round trip.
        noCache: true,
        tv: true
    },
    {
        key: "tpdbLatestMovies",
        title: "Latest Movies",
        endpoint: "/api/tpdb/search/movie",
        viewAll: "/lists/trending/movie",
        tv: true
    },
    {
        key: "tpdbLatestScenes",
        title: "Latest Scenes",
        endpoint: "/api/tpdb/search/tv",
        viewAll: "/lists/trending/tv",
        tv: true
    }
];

/** An entry in the sidebar. */
export interface TvNavItem {
    /** Picks the icon in `sidebar.svelte`, and the highlight on the TV. */
    key: string;
    label: string;
    /*
        Typed against the real route table, so a renamed page fails
        `pnpm run check` here rather than turning into a dead nav entry --
        on two surfaces, one of which nobody is looking at.
    */
    href: Pathname;
    /**
     * Offer this entry on the television.
     *
     * The television renders only the entries it has a page for and skips
     * the rest, so this flag is a statement of intent rather than a
     * guarantee: a genuinely new destination still needs a page written on
     * that side. Reordering, retitling and removing are seamless; adding a
     * screen is not, and no manifest can make it so.
     *
     * The four that are false are form-heavy administrative screens. Each
     * is worse to operate with a remote than with the phone already in the
     * room, and three of them can change the library.
     */
    tv: boolean;
}

export const NAV_ITEMS: TvNavItem[] = [
    { key: "home", label: "Home", href: "/", tv: true },
    { key: "dashboard", label: "Dashboard", href: "/dashboard", tv: false },
    { key: "library", label: "Library", href: "/library", tv: true },
    { key: "explore", label: "Explore", href: "/explore", tv: true },
    { key: "search", label: "Search", href: "/search", tv: true },
    // tv: false -- the account grid and its per-site lazy loading depend on
    // scroll observers and live fetches the TV shell cannot drive.
    { key: "onlyfans", label: "OnlyFans", href: "/onlyfans", tv: false },
    { key: "profile", label: "Profile", href: "/auth", tv: false },
    { key: "settings", label: "Settings", href: "/settings", tv: false },
    { key: "logs", label: "Logs", href: "/logs", tv: false }
];
