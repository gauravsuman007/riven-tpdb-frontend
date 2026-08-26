import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { listStudios, setStudioSaved } from "$lib/studios";

export const load: PageServerLoad = async (event) => {
    if (!event.locals.user || !event.locals.session) {
        return redirect(302, "/auth/login");
    }

    /*
        The whole directory in one request, filtered in the browser as the
        user types. Round-tripping each keystroke would put a live request
        (and a spinner) behind every character; the payload is ~1,200 small
        rows, which is cheaper to send once than to search repeatedly.
    */
    const studios = await listStudios(
        {
            baseUrl: event.locals.backendUrl,
            apiKey: event.locals.apiKey,
            fetch: event.fetch
        },
        { limit: 2000 }
    );

    return { studios };
};

export const actions: Actions = {
    /*
        One action for both directions rather than two. The button knows which
        way it is going and says so; splitting it would mean two near-identical
        actions that could drift apart.
    */
    save: async (event) => {
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
    }
};
