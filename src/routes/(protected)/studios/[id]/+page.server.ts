import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { getStudio, getStudioRows, promoteTitle, setStudioSaved } from "$lib/studios";

export const load: PageServerLoad = async (event) => {
    if (!event.locals.user || !event.locals.session) {
        return redirect(302, "/auth/login");
    }

    const options = {
        baseUrl: event.locals.backendUrl,
        apiKey: event.locals.apiKey,
        fetch: event.fetch
    };

    const studio = await getStudio(Number(event.params.id), options);

    if (!studio) {
        error(404, "No such studio");
    }

    /*
        Streamed, deliberately NOT awaited. The rows are two live storefront
        reads serialised behind a one-request-a-second courtesy delay, so they
        take several seconds and no amount of caching can fix that without
        showing last week's ranking under a heading that says "trending".

        Awaiting here meant the page showed nothing at all for the whole wait,
        including the studio name and logo that were ready immediately.
        Returning the promise lets SvelteKit paint the page now and fill the
        rows in when they land.
    */
    return { studio, rows: getStudioRows(Number(event.params.id), options) };
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
