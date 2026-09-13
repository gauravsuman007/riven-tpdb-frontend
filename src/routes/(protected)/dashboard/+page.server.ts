/*
    The dashboard is a tab on the settings page now, not a page of its own.

    Kept as a redirect rather than deleted: this path is bookmarked, it is
    what older links point at, and a 404 would read as the dashboard having
    been removed rather than moved. The loader itself lives in
    `$lib/server/dashboard.ts` and the markup in
    `$lib/components/settings/dashboard-panel.svelte`.
*/

import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (({ url }) => {
    /*
        The downloads table's query lives in the URL (`dl_page`, `dl_state`,
        `dl_sort`, `dl_search`), so a link to a filtered view has to survive
        the move -- carrying the search string over is what makes it.
    */
    const target = new URL("/settings", url);
    target.search = url.search;
    target.searchParams.set("tab", "dashboard");

    redirect(308, `${target.pathname}${target.search}`);
}) satisfies PageServerLoad;
