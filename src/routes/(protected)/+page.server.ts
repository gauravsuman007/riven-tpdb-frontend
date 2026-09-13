import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import providers from "$lib/providers";
import { transformTPDBList } from "$lib/providers/parser";
import { createScopedLogger } from "$lib/logger";
import { attachLibraryStates } from "$lib/server/library-state";
import { entryHref } from "$lib/collections";
import { getRows, type Recommendation } from "$lib/recommendations";
import { listAddons } from "$lib/addons";
import { getRailLayout } from "$lib/rails";
import type { TMDBNowPlayingItem } from "$lib/components/tmdb-now-playing.svelte";

const logger = createScopedLogger("home");

/**
 * Turn a ranked recommendation into the hero's item shape.
 *
 * A catalogue entry has cover art and no banner, so `poster_path` is passed
 * through for the hero to stand in with; it blurs it to fill the frame and
 * shows the cover sharp beside the text rather than cropping a 2:3 image into
 * a 16:9 one.
 *
 * `href` is set explicitly because a rail item is a `CollectionEntry`, which
 * is addressed by entry id when it has no TPDB match. The hero's default link
 * assumes a TPDB uuid and would 404 on exactly the titles that are not yet in
 * the library -- which is every title the engine recommends.
 */
function heroItem(item: Recommendation, index: number): TMDBNowPlayingItem {
    return {
        // The carousel keys on `id`. A scene result has no entry id, so every
        // one of them would key as 0 and Svelte would fail on the duplicate;
        // the index is the fallback that keeps them distinct.
        id: item.entry_id ?? -(index + 1),
        media_type: item.kind === "scene" ? "tv" : "movie",
        title: item.title,
        backdrop_path: null,
        poster_path: item.poster_path,
        release_date: item.year ? `${item.year}-01-01` : undefined,
        rating: item.rating,
        reasons: item.reasons,
        href:
            item.entry_id === null
                ? null
                : entryHref({
                      id: item.entry_id,
                      tpdb_id: item.tpdb_id,
                      tpdb_kind: item.kind === "scene" ? "scene" : "movie"
                  })
    };
}

/**
 * The hero carousel is the Explore page's "Recommended for you" rail.
 *
 * That row is ranked from award history, storefront ratings, demand and what
 * the library already contains, over titles that are catalogued but not yet
 * owned -- which is a better answer to "what should I watch" than the newest
 * thing TPDB happened to index, and it is the same answer the Explore page
 * gives, so the two surfaces cannot disagree.
 *
 * The TPDB feeds remain as the fallback. The engine ranks what has already
 * been catalogued, so a deployment whose brochure and award corpora have never
 * synced has nothing to rank, and an empty hero would be worse than a generic
 * one.
 */
/**
 * What this page needs to know about its own rows.
 *
 * Both halves, because they are useless apart: the ADD-ONS are the half of
 * the catalogue this app cannot know by itself, and the LAYOUT is which of
 * the catalogue the viewer wants and in what order.
 *
 * Loaded server-side and awaited, unlike the feeds below, because they decide
 * what is drawn at all -- streaming them would mean the page reflows from its
 * defaults into the viewer's arrangement while they are looking at it.
 *
 * Neither can fail the page. An add-on listing that cannot be read is a home
 * page with no add-on rows, which is how it behaved before any of this
 * existed; a layout that cannot be read is an UNARRANGED page, which draws
 * every row it knows about.
 */
async function railData(fetch: typeof globalThis.fetch) {
    const [listed, railLayout] = await Promise.all([
        listAddons(fetch),
        getRailLayout("home", fetch)
    ]);

    return {
        addons: "error" in listed ? [] : listed.addons.addons,
        railLayout
    };
}

export const load: PageServerLoad = async ({ locals, fetch }) => {
    if (!locals.user || !locals.session) redirect(302, "/auth/login");

    try {
        const auth = {
            baseUrl: locals.backendUrl,
            headers: { "x-api-key": locals.apiKey },
            fetch
        };

        const rows = await getRows(
            { baseUrl: locals.backendUrl, apiKey: locals.apiKey, fetch },
            12
        );
        const forYou = rows.rails.find((rail) => rail.key === "for-you");

        if (forYou?.items.length) {
            return { nowPlaying: forYou.items.map(heroItem), ...(await railData(fetch)) };
        }

        logger.info("No ranked recommendations yet; the hero falls back to TPDB.");

        // Only the carousel is awaited. Everything else on this page is below
        // the fold and its promise is streamed, so first paint no longer waits
        // on TPDB's rate limiter.
        const [recommendations, latestMovies] = await Promise.all([
            providers.riven.GET("/api/v1/tpdb/recommendations", {
                ...auth,
                params: { query: { limit: 20 } }
            }),
            providers.riven.GET("/api/v1/tpdb/movies", {
                ...auth,
                params: { query: { per_page: 40 } }
            })
        ]);

        if (recommendations.error) {
            logger.error("TPDB recommendations failed", recommendations.error);
        }

        const recommended = transformTPDBList(
            (recommendations.data?.movies ?? []).map((entry) => entry.movie)
        );
        const latest = transformTPDBList(latestMovies.data ?? []);

        // The fallback carousel is a backdrop-led layout, so anything without
        // one is dropped rather than rendered as an empty panel.
        const withBackdrop = [...recommended, ...latest].filter((item) => item.backdrop_path);

        // "Recently added" is fetched client-side by the page's list store, so
        // it is deliberately not loaded here -- it used to add a serial round
        // trip to every home page render.
        return {
            nowPlaying: await attachLibraryStates(withBackdrop.slice(0, 20), auth),
            ...(await railData(fetch))
        };
    } catch (err) {
        logger.error("Error fetching TPDB home content:", err);
        return { nowPlaying: [], ...(await railData(fetch)) };
    }
};
