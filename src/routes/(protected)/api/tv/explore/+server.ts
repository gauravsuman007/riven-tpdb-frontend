/*
    The Explore screen's rows, arranged, for the television.

    WHY THIS IS NOT PART OF `/api/tv/shell`

    The shell is fetched on EVERY page the television draws -- it holds the
    nav -- and these rows cost a ranking pass over the whole catalogue. Paying
    that to draw a library listing would make every screen on that surface as
    slow as the most expensive one on it.

    WHY THE TELEVISION DOES NOT ARRANGE THEM ITSELF

    It could: the layout and the rails are both reachable from there through
    the proxy. But `arrange()` is a set of small decisions -- a new rail turns
    itself on, a missing one is skipped rather than pruned, an empty layout
    means "never arranged" rather than "everything off" -- and a second
    implementation of those in another language is how the two surfaces come
    to disagree about which rows exist. It is written once, here, and the
    television renders the answer.

    IT CARRIES NO ITEMS, for the same reason the shell does not: a row names
    where its items are and the television fetches those itself, with the
    viewer's own cookies. The ranked rows are the exception and have to be --
    their items come from a call this surface cannot make -- so those arrive
    already ranked.
*/

import type { RequestHandler } from "./$types";
import { error, json } from "@sveltejs/kit";
import { listAddons } from "$lib/addons";
import { addonRails, arrange, EXPLORE_STATIC_RAILS, getRailLayout } from "$lib/rails";
import { getRows } from "$lib/recommendations";

export const GET: RequestHandler = async ({ locals, fetch }) => {
    if (!locals.user || !locals.session) {
        error(401, "Not signed in");
    }

    const options = { baseUrl: locals.backendUrl, apiKey: locals.apiKey, fetch };

    const [rows, listed, layout] = await Promise.all([
        getRows(options, 20),
        listAddons(fetch),
        getRailLayout("explore", fetch)
    ]);

    const ranked = new Map(rows.rails.map((rail) => [rail.key, rail]));

    const catalogue = [
        ...rows.rails.map((rail) => ({
            key: rail.key,
            title: rail.title,
            description: rail.reason,
            source: "ranked",
            defaultPage: "explore" as const,
            tv: true
        })),
        ...EXPLORE_STATIC_RAILS,
        ...addonRails("error" in listed ? [] : listed.addons.addons)
    ];

    return json({
        version: 1,
        rows: arrange(catalogue, layout)
            /*
                The studio row and the storefront shelves are dropped here,
                not hidden over there. Each is a grid of covers with its own
                controls -- following a studio, opening a shelf of 144 titles
                -- and neither shape survives a renderer that draws one kind
                of strip. Their `tv` flag says so; this is where it is read.
            */
            .filter((rail) => rail.tv)
            .map((rail) => ({
                key: rail.key,
                title: rail.title,
                why: rail.description ?? "",
                addon: rail.source === "built-in" || rail.source === "ranked" ? null : rail.source,
                /*
                    A ranked row arrives with its items; an add-on's row
                    arrives with the path to fetch them from. Two shapes,
                    because the two have genuinely different costs: the
                    ranking has already happened here and repeating it over
                    there is not possible, while an add-on's row is one cheap
                    call the television can make for itself.
                */
                items: ranked.get(rail.key)?.items ?? null,
                endpoint: rail.endpoint ?? null
            }))
    });
};
