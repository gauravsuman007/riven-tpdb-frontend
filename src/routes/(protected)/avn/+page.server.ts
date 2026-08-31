import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { getAvnOverview, setAvnEnabled } from "$lib/collections";

export const load: PageServerLoad = async (event) => {
    if (!event.locals.user || !event.locals.session) {
        return redirect(302, "/auth/login");
    }

    /*
        Streamed, not awaited. The overview is one call carrying every ceremony
        year with all its entries -- around 370KB and growing as years fill in
        -- so the page used to sit blank until the whole thing had been fetched
        and parsed. Returning the promise lets the shell and the year rail
        render at once.
    */
    return {
        overview: getAvnOverview({
            baseUrl: event.locals.backendUrl,
            apiKey: event.locals.apiKey,
            fetch: event.fetch
        })
    };
};

export const actions: Actions = {
    /*
        One switch, two effects, and both are needed. The backend saves the
        setting (so Settings → Content → Awards agrees with this page, and the
        choice survives a restart) *and* re-registers the scheduled job (so
        data starts arriving now rather than at the next restart).
    */
    enable: async (event) => {
        const data = await event.request.formData();
        const enabled = data.get("enabled") !== "false";

        const result = await setAvnEnabled(enabled, {
            baseUrl: event.locals.backendUrl,
            apiKey: event.locals.apiKey,
            fetch: event.fetch
        });

        if (!result.ok) {
            return fail(409, { message: result.message });
        }

        return { message: result.data?.message ?? result.message, enabled };
    }
};
