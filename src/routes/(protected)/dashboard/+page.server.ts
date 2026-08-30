import type { PageServerLoad } from "./$types";
import providers from "$lib/providers";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("dashboard");

const DOWNLOADS_PAGE_SIZE = 15;

const EMPTY_DOWNLOADS = {
    active: [],
    recent: [],
    page: 1,
    limit: DOWNLOADS_PAGE_SIZE,
    total_active: 0,
    total_pages: 1
};

/**
 * Nothing is awaited here, and that is the point.
 *
 * This used to `Promise.all` four backend calls and 500 the page if any of the
 * first three failed, so the dashboard appeared only once its slowest query
 * finished -- and `downloader_user_info` calls out to the debrid provider, so
 * "slowest" means however long TorBox is taking today. Reported as the
 * dashboard sometimes taking a long time to load, which it did, entirely
 * correctly.
 *
 * Returning the promises unawaited lets SvelteKit render the page immediately
 * and stream each card in as it arrives. A failure now degrades one card
 * instead of replacing the page with an error, which is the honest behaviour
 * anyway: a dead downloader says nothing about the library statistics beside
 * it.
 */
export const load = (async ({ fetch, locals, url }) => {
    const page = Math.max(1, Number(url.searchParams.get("dl_page")) || 1);
    const states = url.searchParams.getAll("dl_state");
    const sort = url.searchParams.getAll("dl_sort");
    const search = url.searchParams.get("dl_search") || undefined;

    const call = {
        baseUrl: locals.backendUrl,
        headers: { "x-api-key": locals.apiKey },
        fetch
    };

    /**
     * Unwrap one openapi-fetch result, logging and yielding a fallback rather
     * than throwing: a rejected streamed promise surfaces as an unhandled
     * error on the client, which is a worse outcome than an empty card.
     */
    async function settle<T>(
        request: Promise<{ data?: T; error?: unknown }>,
        what: string,
        fallback?: T
    ): Promise<T | undefined> {
        try {
            const result = await request;

            if (result.error) {
                logger.error(`${what} fetch error:`, result.error);
                return fallback;
            }

            return result.data ?? fallback;
        } catch (reason) {
            logger.error(`${what} fetch threw:`, reason);
            return fallback;
        }
    }

    return {
        statistics: settle(providers.riven.GET("/api/v1/stats", call), "Statistics"),
        services: settle(providers.riven.GET("/api/v1/services", call), "Services", {}),
        downloaderInfo: settle(
            providers.riven.GET("/api/v1/downloader_user_info", call),
            "Downloader info"
        ),
        downloads: settle(
            providers.riven.GET("/api/v1/items/downloads", {
                ...call,
                params: {
                    query: {
                        limit: DOWNLOADS_PAGE_SIZE,
                        page,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        states: states.length ? (states as any) : undefined,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        sort: sort.length ? (sort as any) : undefined,
                        search
                    }
                }
            }),
            "Download activity",
            { ...EMPTY_DOWNLOADS, page }
        )
    };
}) satisfies PageServerLoad;
