/*
    What the television should draw.

    `riven-tv` cannot run this app's bundle -- see `$lib/tv/manifest` for why
    -- so it renders its own markup over this API. This route is the seam:
    the rows, the nav and the palette come from here, so changing any of them
    is an edit in this repository and the other surface follows on its next
    page load with no release of its own.

    It carries no items. A row names the endpoint that holds its items, and
    the television fetches those itself, with the viewer's own cookies, the
    same way this app's `MediaListStore` does. Inlining them would make this
    route as slow as the slowest feed on it and would duplicate paging,
    caching and rate limiting that already work.

    `version` is for the other side to refuse a shape it does not understand
    rather than to render half a page from it.
*/

import type { RequestHandler } from "./$types";
import { error, json } from "@sveltejs/kit";
import { HOME_ROWS, NAV_ITEMS } from "$lib/tv/manifest";
import { themeTokens } from "$lib/tv/theme";

export const GET: RequestHandler = async ({ locals }) => {
    /*
        The same gate as every other route in this directory. The television
        forwards the viewer's cookies, so a signed-out set is signed out
        here too -- that surface adds no authority of its own, deliberately.
    */
    if (!locals.user || !locals.session) {
        error(401, "Not signed in");
    }

    return json({
        version: 1,
        nav: NAV_ITEMS.filter((item) => item.tv).map(({ key, label, href }) => ({
            key,
            label,
            href
        })),
        rows: HOME_ROWS.filter((row) => row.tv).map(({ key, title, endpoint, viewAll }) => ({
            key,
            title,
            endpoint,
            viewAll
        })),
        theme: themeTokens()
    });
};
