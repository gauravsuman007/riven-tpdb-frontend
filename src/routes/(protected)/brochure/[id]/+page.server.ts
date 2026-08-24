import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { getEntry, requestEntry } from "$lib/collections";
import providers from "$lib/providers";

export const load: PageServerLoad = async (event) => {
    if (!event.locals.user || !event.locals.session) {
        return redirect(302, "/auth/login");
    }

    const auth = {
        baseUrl: event.locals.backendUrl,
        headers: { "x-api-key": event.locals.apiKey },
        fetch: event.fetch
    };

    const entry = await getEntry(Number(event.params.id), {
        baseUrl: event.locals.backendUrl,
        apiKey: event.locals.apiKey,
        fetch: event.fetch
    });

    if (!entry) {
        error(404, "No such brochure title");
    }

    /*
        Same endpoint and same detail form the TPDB page uses, so this page can
        render files, candidate releases and a Play button identically. Keyed on
        the Adult Empire id, which is the only id a brochure title has until the
        TPDB backfill finds it one.
    */
    const ids = entry.external_id ? [entry.external_id] : [];
    const library = ids.length
        ? await providers.riven.GET("/api/v1/items/library_states", {
              ...auth,
              params: { query: { adultempire_ids: ids, detailed: true } }
          })
        : null;

    // Absent from the response means "not in the library" -- the endpoint omits
    // ids it does not know rather than erroring.
    const libraryState = entry.external_id
        ? ((library?.data?.states as Record<string, any> | undefined)?.[entry.external_id] ?? null)
        : null;

    return { entry, libraryState };
};

export const actions: Actions = {
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

        return { message: result.message, requested: true };
    }
};
