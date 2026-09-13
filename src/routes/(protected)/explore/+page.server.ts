import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { getBrochure, getBrochureStatus } from "$lib/collections";
import { listStudios, setStudioSaved } from "$lib/studios";
import {
    getCategoryIndex,
    getRows,
    getVocabulary,
    ingestVocabulary,
    syncCategoryIndex
} from "$lib/recommendations";

export const load: PageServerLoad = async (event) => {
    if (!event.locals.user || !event.locals.session) {
        return redirect(302, "/auth/login");
    }

    const options = {
        baseUrl: event.locals.backendUrl,
        apiKey: event.locals.apiKey,
        fetch: event.fetch
    };

    /*
        Streamed, not awaited.

        The rails are ranked from rows already in the database, so the movie
        engine is fast -- but the scene rails call StashDB, and a slow provider
        would otherwise hold back the tab strip and the heading with it. The
        page shell paints first; the rows arrive underneath.

        THE BROCHURE'S ROWS BELONG ON THIS PAGE TOO. They were a tab of their
        own, which put the catalogue Riven actually mirrors one click further
        away than the ranked rails computed from it -- and left Explore saying
        "nothing to rank yet" while a thousand synced bestsellers sat behind a
        tab nobody had opened. The shelves and the followed studios now sit
        under the ranked rails here; the tab stays, because it is also where
        the brochure is switched on and explained.

        Each of them is streamed separately because they are independent, and
        a slow one must not hold up the rest: the shelves and studios are
        local reads and land immediately, the scene rails wait on StashDB.

        Vocabulary status stays awaited: it is a two-field local read, and it
        decides whether the page shows a "read the vocabulary" prompt at all.
        Streaming that would make the prompt appear a beat after the rows,
        which reads as a glitch.
    */
    return {
        vocabulary: await getVocabulary(options),
        categoryIndex: await getCategoryIndex(options),
        rows: getRows(options, 20),
        shelves: getBrochure(options, 24),
        brochure: getBrochureStatus(options),
        /*
            Saved studios, and a handful of the biggest as a starting point.
            The full directory is a hundred-odd names and belongs on its own
            page; putting it here would bury the two or three studios somebody
            follows under ninety-seven they do not.
        */
        studios: listStudios(options, { saved: true }),
        studioSuggestions: listStudios(options, { limit: 12 })
    };
};

export const actions: Actions = {
    /*
        Follow or unfollow one studio, from the row itself.

        The same shape as the directory page's action, deliberately: the row
        and the directory are two views of one list, and a second way of
        saying "saved" would be a second thing to keep in step.
    */
    saveStudio: async (event) => {
        const data = await event.request.formData();
        const studioId = Number(data.get("studioId"));
        const saved = data.get("saved") === "true";

        if (!Number.isFinite(studioId)) {
            return fail(400, { message: "Missing studio id" });
        }

        const result = await setStudioSaved(studioId, saved, {
            baseUrl: event.locals.backendUrl,
            apiKey: event.locals.apiKey,
            fetch: event.fetch
        });

        if (!result.ok) {
            return fail(409, { message: result.message });
        }

        return { message: result.message };
    },

    /*
        Read StashDB's tag graph into the local facet vocabulary. About thirty
        calls, and the graph is curated and barely moves, so this is a button
        rather than a scheduled job -- and until it has been pressed once the
        scene engine has no tag ids to filter on and says so instead of
        quietly serving newest-first results under an intent's name.
    */
    ingest: async (event) => {
        const result = await ingestVocabulary({
            baseUrl: event.locals.backendUrl,
            apiKey: event.locals.apiKey,
            fetch: event.fetch
        });

        if (!result.ok) {
            return fail(409, { message: result.message });
        }

        return { message: result.message };
    },

    /*
        Build the movie corpus's genre index. Separate from the vocabulary
        ingest above because they solve different halves of the same gap: the
        vocabulary says what a tag *means*, this supplies the tags at all for
        movies. An Adult Empire product page carries length, year, studio and
        cast and no genre whatsoever, so the categories have to be read from
        the other direction -- which is a few minutes of courtesy-delayed
        crawling, and therefore runs in the background.
    */
    indexCategories: async (event) => {
        const result = await syncCategoryIndex({
            baseUrl: event.locals.backendUrl,
            apiKey: event.locals.apiKey,
            fetch: event.fetch
        });

        if (!result.ok) {
            return fail(409, { message: result.message });
        }

        return { message: result.message };
    }
};
