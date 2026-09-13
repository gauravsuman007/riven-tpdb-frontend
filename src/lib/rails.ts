/*
    Which rows a page shows, in what order, and where that is decided.

    THE SPLIT THIS FILE EXISTS TO KEEP
    ----------------------------------

    A rail has two halves that change at completely different rates:

      * its DEFINITION -- title, where its items come from, whether a
        television can draw it. That travels with the code that draws it:
        `$lib/tv/manifest` for this app's home rows, the recommendation
        engine for Explore's ranked rows, an add-on for the rows it
        contributes.

      * its ARRANGEMENT -- is it on, and in what position. That is the
        user's, it is stored in the backend's `RailLayout`, and it has to
        survive every release of every one of those definitions.

    So the backend stores KEYS and nothing else, and this file is where the
    two halves are put back together. Storing a title alongside the order
    would mean a retitled row keeps its old name on every deployment that
    ever saved a layout -- and the stale copy is the one on screen.

    WHY A NEW RAIL TURNS ITSELF ON
    ------------------------------

    `arrange()` appends catalogued rails a saved layout has never heard of,
    rather than dropping them. The alternative is that every row added by an
    update is invisible to precisely the users who have arranged their pages
    -- the ones who would most want it -- and invisible in a way that looks
    like the update not having landed. A user who does not want it turns it
    off, which is a decision the layout then remembers.

    WHY A MISSING RAIL IS NOT A DELETION
    ------------------------------------

    The other direction is the mirror: a key in the layout that nothing
    offers today is skipped and left in the layout untouched. An add-on
    switched off for an afternoon stops catalogueing its rails, so its rows
    leave every page; switching it back on puts them back where they were.
    Pruning would turn that into "arrange all your pages again".
*/

import type { Addon } from "$lib/addons";
import { HOME_ROWS } from "$lib/tv/manifest";

/** The three pages that can be arranged, plus `x/<key>` for an add-on's. */
export type RailPage = "home" | "explore" | `x/${string}`;

/** One row, as it is offered in a picker and drawn on a page. */
export interface RailDef {
    /** Stable across releases: it is what the layout stores. */
    key: string;
    title: string;
    description?: string;
    /**
     * Who defines it -- "built-in", or an add-on's key. Shown in the picker
     * so "Trending" from the index and "Trending" from the storefront are
     * distinguishable, and used to filter an add-on's own page down to its
     * own rows.
     */
    source: string;
    /** Where it sits before anyone arranges the page. */
    defaultPage: RailPage | "none";
    /** A path returning this row's items, for the rows that are fetched. */
    endpoint?: string;
    viewAll?: string | null;
    noCache?: boolean;
    /** Whether the television can draw it. */
    tv: boolean;
}

/** One rail's place, as the backend stores it. */
export interface RailPlacement {
    key: string;
    enabled: boolean;
}

/*
    This app's own home rows, in the vocabulary above.

    `$lib/tv/manifest` stays the definition -- it is what `MediaListStore` and
    the television's shell already read, and a second list here would be the
    exact drift that file was written to stop.
*/
export function builtinHomeRails(): RailDef[] {
    return HOME_ROWS.map((row) => ({
        key: row.key,
        title: row.title,
        source: "built-in",
        defaultPage: "home" as const,
        endpoint: row.endpoint,
        viewAll: row.viewAll,
        noCache: row.noCache,
        tv: row.tv
    }));
}

/**
 * Explore's two catalogue rows.
 *
 * The ranked rails are NOT here: their keys depend on the configured
 * intents, so they are catalogued from the engine's own answer at load time
 * (see the Explore page). These two are fixed, and they are the rows that
 * work before any of the ranking does.
 */
export const EXPLORE_STATIC_RAILS: RailDef[] = [
    {
        key: "studios",
        title: "Studios",
        description: "The studios you follow, and their bestsellers.",
        source: "built-in",
        defaultPage: "explore",
        tv: false
    },
    {
        key: "shelves",
        title: "Adult Empire shelves",
        description: "The storefront's own ordering, mirrored locally.",
        source: "built-in",
        defaultPage: "explore",
        tv: false
    }
];

/** Every rail every loaded add-on offers, in this app's vocabulary. */
export function addonRails(addons: Addon[]): RailDef[] {
    return addons.flatMap((addon) =>
        (addon.rails ?? []).map((rail) => ({
            key: rail.key,
            title: rail.title,
            description: rail.description || undefined,
            source: addon.key,
            defaultPage: (rail.default_page === "own" ? `x/${addon.key}` : rail.default_page) as
                | RailPage
                | "none",
            /*
                Made absolute here, once. An add-on declares a path relative
                to its own mount precisely so it cannot name any other one,
                and resolving it at every call site would be twenty chances
                to forget which half was which.
            */
            endpoint: rail.endpoint ? `/api/v1/x/${addon.key}${rail.endpoint}` : undefined,
            tv: rail.tv
        }))
    );
}

/**
 * The rows one page should draw, in order.
 *
 * `catalogue` is everything that page may offer; `layout` is what was saved,
 * empty when the page has never been arranged. Empty is NOT "everything off"
 * -- that distinction is the reason the backend returns the saved list
 * verbatim instead of filling in defaults, and it is why a user who switches
 * every row off does not watch the page put them all back.
 */
export function arrange(catalogue: RailDef[], layout: RailPlacement[], page: RailPage): RailDef[] {
    /*
        `defaultPage` decides what a page shows on its own, and it is checked
        against THIS page rather than merely against "none".
        `addonRails()` turns an add-on's "own" into `x/<key>`, so without
        this an installed add-on's performer rows would appear on somebody's
        Home the moment it loaded -- a page they had never arranged suddenly
        carrying rows they never asked for.
    */
    const belongs = (rail: RailDef) => rail.defaultPage === page;

    if (!layout.length) {
        return catalogue.filter(belongs);
    }

    const byKey = new Map(catalogue.map((rail) => [rail.key, rail]));
    const placed = new Set<string>();
    const ordered: RailDef[] = [];

    for (const entry of layout) {
        const rail = byKey.get(entry.key);
        placed.add(entry.key);

        // Skipped, not dropped: the backend still holds its position.
        if (rail && entry.enabled) ordered.push(rail);
    }

    /*
        Rails the saved layout has never heard of -- everything an update
        added, everything an add-on installed since. On, at the end, and only
        the ones that belong to this page by default.

        Belonging matters here for the same reason as above and one more: an
        arranged page must not gain rows from an add-on installed for a
        different screen. What it SHOULD gain is a row the app itself added,
        which is the case this branch exists for -- otherwise every new row is
        invisible to exactly the people who have arranged their pages.
    */
    for (const rail of catalogue) {
        if (!placed.has(rail.key) && belongs(rail)) ordered.push(rail);
    }

    return ordered;
}

/**
 * The picker's view: every offered rail with its current on/off, in the
 * order the page draws them, followed by the ones that are off.
 *
 * EVERYTHING IN THE CATALOGUE IS OFFERED, including rails that belong to
 * another page by default -- that is what "add a row" means on Home and
 * Explore, and it is why the caller decides what the catalogue contains. An
 * add-on's own page is narrowed by passing only that add-on's rails in;
 * narrowing here instead would make it impossible to put a performer row on
 * Home at all.
 *
 * `arrange` is the other half and does the opposite: it filters by page,
 * because a row nobody has asked for should not appear on a page nobody has
 * arranged.
 */
export function forEditing(
    catalogue: RailDef[],
    layout: RailPlacement[],
    page: RailPage
): RailPlacement[] {
    const shown = arrange(catalogue, layout, page);
    const shownKeys = new Set(shown.map((rail) => rail.key));

    return [
        ...shown.map((rail) => ({ key: rail.key, enabled: true })),
        ...catalogue
            .filter((rail) => !shownKeys.has(rail.key))
            .map((rail) => ({ key: rail.key, enabled: false }))
    ];
}

// ----------------------------------------------------------------- the API

/*
    Both halves go through the app's own proxy rather than to the backend
    directly, so a browser call carries the viewer's session and a server
    load carries the request's cookies -- the same rule every other client in
    `$lib` follows.
*/
export async function getRailLayout(
    page: RailPage,
    f: typeof globalThis.fetch = globalThis.fetch
): Promise<RailPlacement[]> {
    try {
        const response = await f(`/api/v1/rails/${page}`);
        if (!response.ok) return [];
        const body = (await response.json()) as { rails?: RailPlacement[] };
        return body.rails ?? [];
    } catch {
        /*
            An unreachable layout is an UNARRANGED page, never an empty one.
            Returning [] here lands in `arrange`'s "never arranged" branch,
            which draws every row the page knows about -- the behaviour
            before any of this existed. A blank page because a small
            preferences call failed would be a much worse trade.
        */
        return [];
    }
}

export async function saveRailLayout(page: RailPage, rails: RailPlacement[]): Promise<boolean> {
    try {
        const response = await fetch(`/api/v1/rails/${page}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rails)
        });
        return response.ok;
    } catch {
        return false;
    }
}
