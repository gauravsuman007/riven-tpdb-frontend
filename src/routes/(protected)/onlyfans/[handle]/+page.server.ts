import type { PageServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { getAccount } from "$lib/onlyfans";

export const load: PageServerLoad = async (event) => {
    if (!event.locals.user || !event.locals.session) {
        return redirect(302, "/auth/login");
    }

    /*
        The account and its sources only. Content is deliberately not loaded
        here: it is read live from each site, one site per button, so fetching
        it up front would make this page as slow as the slowest archive site
        and would fetch four sites the user may never open.
    */
    const account = await getAccount(event.params.handle, {
        baseUrl: event.locals.backendUrl,
        apiKey: event.locals.apiKey,
        fetch: event.fetch
    });

    if (!account) {
        error(404, "No such performer");
    }

    return { account };
};
