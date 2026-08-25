import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { getStudio, promoteTitle, setStudioSaved } from "$lib/studios";

export const load: PageServerLoad = async (event) => {
    if (!event.locals.user || !event.locals.session) {
        return redirect(302, "/auth/login");
    }

    /*
        Slow on purpose, and there is no way around it. Both rows are read live
        from the storefront, one request each, serialised behind its
        one-request-a-second courtesy delay. Caching them would mean showing a
        ranking from last week under a heading that says "trending".
    */
    const studio = await getStudio(Number(event.params.id), {
        baseUrl: event.locals.backendUrl,
        apiKey: event.locals.apiKey,
        fetch: event.fetch
    });

    if (!studio) {
        error(404, "No such studio");
    }

    return { studio };
};

export const actions: Actions = {
    /*
        A studio's rows are read live and have no database row until someone
        opens one. This promotes the clicked title to a real catalogue entry
        and hands off to the ordinary brochure detail page, so a studio title
        and a bestseller are the same page and the same code from here on.
    */
    open: async (event) => {
        const data = await event.request.formData();
        const productId = String(data.get("productId") ?? "");

        if (!productId) {
            return fail(400, { message: "Missing title id" });
        }

        const result = await promoteTitle(productId, {
            baseUrl: event.locals.backendUrl,
            apiKey: event.locals.apiKey,
            fetch: event.fetch
        });

        if (!result.ok || !result.entryId) {
            return fail(502, { message: result.message });
        }

        /*
            Straight to the brochure entry. That page already redirects on to
            the full TPDB page when the title resolved, so this deliberately
            does not try to decide that here -- one place owns that branch.
        */
        redirect(303, `/brochure/${result.entryId}`);
    },

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
