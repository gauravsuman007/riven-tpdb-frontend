import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import providers from "$lib/providers";
import * as dateUtils from "$lib/utils/date";

const PER_PAGE = 24;

interface RivenItem {
    id: number | string;
    title: string;
    type: string;
    poster_path?: string | null;
    aired_at?: string | null;
    state?: string | null;
}

/*
    Only what a card shows. Deliberately not the library page's
    `transformItems`: that one resolves an external indexer id so it can link
    to a TMDB/TPDB detail page, and this section never leaves the app -- every
    link here is a Riven id, which every item has. That is also what keeps
    adult titles, which carry no TMDB or TVDB id, from being dropped.
*/
function toCard(item: RivenItem) {
    return {
        id: Number(item.id),
        title: item.title,
        poster: item.poster_path ?? null,
        year: dateUtils.getYearFromISO(item.aired_at ?? "") ?? null,
        state: item.state ?? null
    };
}

export const load: PageServerLoad = async (event) => {
    const search = event.url.searchParams.get("q")?.trim() || undefined;
    const page = Math.max(1, Number(event.url.searchParams.get("page") ?? 1) || 1);

    const response = await providers.riven.GET("/api/v1/items", {
        params: {
            query: {
                limit: PER_PAGE,
                page,
                type: ["movie", "show"],
                states: ["All"],
                sort: ["date_desc"],
                ...(search ? { search } : {})
            }
        },
        baseUrl: event.locals.backendUrl,
        headers: { "x-api-key": event.locals.apiKey },
        fetch: event.fetch
    });

    if (response.error) error(500, "Could not reach the library");

    const data = response.data;

    return {
        search: search ?? "",
        page: data?.page ?? 1,
        totalPages: data?.total_pages ?? 1,
        items: ((data?.items ?? []) as unknown as RivenItem[]).map(toCard)
    };
};
