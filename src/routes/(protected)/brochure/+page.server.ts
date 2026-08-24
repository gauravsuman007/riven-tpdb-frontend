import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { getBrochure } from "$lib/collections";

export const load: PageServerLoad = async (event) => {
    if (!event.locals.user || !event.locals.session) {
        return redirect(302, "/auth/login");
    }

    const shelves = await getBrochure(
        {
            baseUrl: event.locals.backendUrl,
            apiKey: event.locals.apiKey,
            fetch: event.fetch
        },
        24
    );

    return { shelves };
};
