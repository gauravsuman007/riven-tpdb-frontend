import type { PageServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { getAvnCategory } from "$lib/collections";

/*
    One AVN category, every ceremony's winners, newest first.

    Awaited, not streamed: it is one local read over the synced corpus and it
    is the whole page, so streaming it would only add a skeleton flash.
*/
export const load: PageServerLoad = async ({ params, locals, fetch }) => {
    if (!locals.user || !locals.session) redirect(302, "/auth/login");

    const detail = await getAvnCategory(params.key, {
        baseUrl: locals.backendUrl,
        apiKey: locals.apiKey,
        fetch
    });

    if (!detail) error(404, "No such AVN category");

    return detail;
};
