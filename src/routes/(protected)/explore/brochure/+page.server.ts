import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { getBrochure, getBrochureStatus, setBrochureEnabled } from "$lib/collections";
import { listStudios } from "$lib/studios";

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
        Status as well as shelves, because empty shelves are ambiguous on their
        own: the brochure is either switched off or switched on and waiting for
        its first sync, and those need very different things said about them.
    */
    /*
        Saved studios only. The full directory is a hundred names and belongs
        on its own page -- putting it here would bury the two or three studios
        the user actually follows under ninety-seven they do not.
    */
    const [shelves, status, studios] = await Promise.all([
        getBrochure(options, 24),
        getBrochureStatus(options),
        listStudios(options, { saved: true })
    ]);

    return { shelves, status, studios };
};

export const actions: Actions = {
    /*
        One switch, two effects, and both are needed. The backend saves the
        setting (so Settings -> Content -> Brochure agrees with this page, and
        the choice survives a restart) *and* re-registers the scheduled job (so
        listings start arriving now rather than at the next restart).
    */
    enable: async (event) => {
        const data = await event.request.formData();
        const enabled = data.get("enabled") !== "false";

        const result = await setBrochureEnabled(enabled, {
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
