import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import {
    deleteCollection,
    getCollection,
    removeFromCollection,
    requestEntry
} from "$lib/collections";

export const load: PageServerLoad = async (event) => {
    if (!event.locals.user || !event.locals.session) {
        return redirect(302, "/auth/login");
    }

    const options = {
        baseUrl: event.locals.backendUrl,
        apiKey: event.locals.apiKey,
        fetch: event.fetch
    };

    const winnersOnly = event.url.searchParams.get("winners") === "1";
    const matchedOnly = event.url.searchParams.get("matched") === "1";

    const collection = await getCollection(event.params.key, options, {
        winnersOnly,
        matchedOnly,
        limit: 1000
    });

    if (!collection) {
        error(404, `No collection "${event.params.key}"`);
    }

    return { collection, winnersOnly, matchedOnly };
};

export const actions: Actions = {
    /**
     * Promote one entry into the library.
     *
     * Deliberately per-entry: there is no "request all" action, because a year
     * holds several hundred entries and queueing them at once is the flood the
     * collection model exists to avoid.
     */
    request: async (event) => {
        const data = await event.request.formData();
        const entryId = Number(data.get("entryId"));

        if (!Number.isFinite(entryId)) {
            return fail(400, { message: "Missing entry id" });
        }

        const result = await requestEntry(entryId, {
            baseUrl: event.locals.backendUrl,
            apiKey: event.locals.apiKey,
            fetch: event.fetch
        });

        if (!result.ok) {
            return fail(409, { message: result.message });
        }

        return { message: result.message };
    },

    /**
     * Remove one title from a user collection.
     *
     * Local only, and only for user collections -- a source-built catalogue is
     * rebuilt on every sync, so removing a row from one would achieve nothing.
     * The backend rejects those; this action just surfaces the reason.
     */
    remove: async (event) => {
        const data = await event.request.formData();
        const entryId = Number(data.get("entryId"));

        if (!Number.isFinite(entryId)) {
            return fail(400, { message: "Missing entry id" });
        }

        const result = await removeFromCollection(event.params.key, entryId, {
            baseUrl: event.locals.backendUrl,
            apiKey: event.locals.apiKey,
            fetch: event.fetch
        });

        if (!result.ok) {
            return fail(409, { message: result.message });
        }

        return { message: result.message };
    },

    /**
     * Delete the collection itself.
     *
     * Nothing leaves the library: entries are catalogue rows, so a title that
     * was requested from this collection stays exactly where it is.
     */
    destroy: async (event) => {
        const result = await deleteCollection(event.params.key, {
            baseUrl: event.locals.backendUrl,
            apiKey: event.locals.apiKey,
            fetch: event.fetch
        });

        if (!result.ok) {
            return fail(409, { message: result.message });
        }

        return redirect(303, "/library");
    }
};
