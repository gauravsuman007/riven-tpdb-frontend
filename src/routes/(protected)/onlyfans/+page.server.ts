import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listAccounts } from "$lib/onlyfans";

export const load: PageServerLoad = async (event) => {
    if (!event.locals.user || !event.locals.session) {
        return redirect(302, "/auth/login");
    }

    /*
        The first page only, unlike the studios page which sends its whole
        directory and filters in the browser. That works there because the
        directory is ~1,200 small rows; this index runs to tens of thousands
        across five sites, so both the search and the scroll are served from
        the backend.
    */
    const page = await listAccounts(
        {
            baseUrl: event.locals.backendUrl,
            apiKey: event.locals.apiKey,
            fetch: event.fetch
        },
        { limit: 60, offset: 0 }
    );

    return { page };
};
