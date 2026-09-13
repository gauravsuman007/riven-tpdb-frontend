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
import { NAV_ITEMS } from "$lib/tv/manifest";
import { addonRails, arrange, builtinHomeRails, getRailLayout } from "$lib/rails";
import { themeTokens } from "$lib/tv/theme";
import { listAddons } from "$lib/addons";

/*
    WHY ADD-ONS ARE LISTED HERE AND NOT DISCOVERED OVER THERE.

    `riven-tv` has no API key and no route to the backend; it reaches
    everything through this app with the viewer's own cookies. It could ask
    `/api/v1/addons` itself, but that answer is the settings page's -- every
    add-on including the disabled and the broken, with its schema, its saved
    settings and its byte count -- and the television needs none of it and
    must not act on most of it.

    So the filtering happens on this side, where "installed", "enabled" and
    "working" are already understood, and what crosses is the short answer:
    the add-ons a television may actually draw, and which of the two shapes
    each one offers.

    A NEW ADD-ON THEREFORE COSTS NO RELEASE OF EITHER SURFACE. It declares
    `AddonTv` in its manifest, and it appears on the television on that set's
    next page load -- the same property the rows above already have.
*/
async function tvAddons(fetch: typeof globalThis.fetch) {
    const result = await listAddons(fetch);

    // Never an error. An add-on listing that cannot be read is a television
    // with no add-on sections on it, which is exactly how a set behaved
    // before any of this existed -- not a screen that fails to render.
    if ("error" in result) return [];

    return (
        result.addons.addons
            /*
            `nav` is NOT required. An add-on with no page of its own has none
            -- the tube scraper is exactly that, a section on a title rather
            than a screen -- and requiring it here would have silently
            excluded the one add-on the television most needs.
        */
            .filter((addon) => addon.state === "ok" && addon.tv)
            .map((addon) => ({
                key: addon.key,
                label: addon.nav?.label ?? addon.name,
                /*
                The lucide name the add-on declared. The other surface has no
                icon font and no sprite -- it hand-draws a small set inline --
                so this is a request, not a guarantee: a name it has not
                drawn falls back to the same mountain the sidebar here uses.
            */
                icon: addon.nav?.icon ?? "puzzle",
                /*
                What the OTHER surface calls it. `riven-tv` writes its own
                path -- it has a session in front of every URL and this app
                does not -- so this is the identity of the destination, not a
                link to follow.
            */
                href: addon.nav?.href ?? `/x/${addon.key}`,
                browse: Boolean(addon.tv?.browse),
                title: Boolean(addon.tv?.title)
            }))
            .filter((addon) => addon.browse || addon.title)
    );
}

/**
 * Every row the home page could draw, in this app's vocabulary.
 *
 * Its own, still defined in `$lib/tv/manifest` so that both renderers keep
 * reading one list, plus every row each installed add-on offers. An add-on's
 * rows reach the television by exactly the same route as this app's, which
 * is what stops the set falling a version behind when one is installed.
 */
async function railCatalogue(fetch: typeof globalThis.fetch) {
    const result = await listAddons(fetch);

    return [...builtinHomeRails(), ...addonRails("error" in result ? [] : result.addons.addons)];
}

export const GET: RequestHandler = async ({ locals, fetch }) => {
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
        /*
            ADDITIVE, and `version` deliberately stays 1. The other side
            refuses a version it does not understand and falls back to a
            hard-coded shell, so bumping this to announce a new field would
            take the whole manifest away from every television running an
            older build -- to tell it about a feature it could not use
            anyway. An unknown field is ignored there; a wrong version is not.
        */
        addons: await tvAddons(fetch),
        nav: NAV_ITEMS.filter((item) => item.tv).map(({ key, label, href }) => ({
            key,
            label,
            href
        })),
        /*
            THE VIEWER'S OWN ARRANGEMENT, not this app's defaults.

            The television renders whatever rows this route names, so a row
            moved or switched off here has to move or disappear there too --
            otherwise "arrange your home page" would mean "arrange one of your
            two home pages", and the one in the living room would be the stale
            one nobody thinks to check.

            The `tv` flag is still applied AFTER the arrangement. It is a fact
            about the row, not about the order: a set has no way to request a
            title, so a row of things it can only look at is worth less there,
            and a row whose items that renderer cannot draw would be an empty
            strip rather than a feature. An add-on's rail says the same thing
            about itself.
        */
        rows: arrange(await railCatalogue(fetch), await getRailLayout("home", fetch), "home")
            .filter((rail) => rail.tv && rail.endpoint)
            .map(({ key, title, endpoint, viewAll, source }) => ({
                key,
                title,
                endpoint,
                viewAll: viewAll ?? null,
                /*
                    Which renderer draws it over there. An add-on's row
                    answers normalised CARDS -- an id and what pressing it
                    does -- and the television already has a renderer for
                    those; this app's own rows answer library and TPDB items,
                    which it draws differently. Naming the add-on is enough
                    for it to pick, and to build the card's address, which no
                    card carries.
                */
                addon: source === "built-in" ? null : source
            })),
        theme: themeTokens()
    });
};
