import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { getRows, getVocabulary, ingestVocabulary } from "$lib/recommendations";

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

        Vocabulary status is awaited: it is a two-field local read, and it
        decides whether the page shows a "refresh vocabulary" prompt at all.
        Streaming that would make the prompt appear a beat after the rows,
        which reads as a glitch.
    */
    return {
        vocabulary: await getVocabulary(options),
        rows: getRows(options, 20)
    };
};

export const actions: Actions = {
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
    }
};
