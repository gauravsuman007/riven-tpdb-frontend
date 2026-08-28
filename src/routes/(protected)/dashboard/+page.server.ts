import type { PageServerLoad } from "./$types";
import providers from "$lib/providers";
import { error } from "@sveltejs/kit";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("dashboard");

const DOWNLOADS_PAGE_SIZE = 15;

export const load = (async ({ fetch, locals, url }) => {
    const page = Math.max(1, Number(url.searchParams.get("dl_page")) || 1);
    const states = url.searchParams.getAll("dl_state");
    const sort = url.searchParams.getAll("dl_sort");
    const search = url.searchParams.get("dl_search") || undefined;

    const [statistics, svc, downloaderInfo, downloads] = await Promise.all([
        providers.riven.GET("/api/v1/stats", {
            baseUrl: locals.backendUrl,
            headers: {
                "x-api-key": locals.apiKey
            },
            fetch: fetch
        }),

        providers.riven.GET("/api/v1/services", {
            baseUrl: locals.backendUrl,
            headers: {
                "x-api-key": locals.apiKey
            },
            fetch: fetch
        }),
        providers.riven.GET("/api/v1/downloader_user_info", {
            baseUrl: locals.backendUrl,
            headers: {
                "x-api-key": locals.apiKey
            },
            fetch: fetch
        }),
        providers.riven.GET("/api/v1/items/downloads", {
            baseUrl: locals.backendUrl,
            headers: {
                "x-api-key": locals.apiKey
            },
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
            },
            fetch: fetch
        })
    ]);

    if (statistics.error) {
        logger.error("Statistics fetch error:", statistics.error);
        error(500, "Unable to fetch stats data");
    }

    if (svc.error) {
        logger.error("Services fetch error:", svc.error);
        error(500, "Unable to fetch services data");
    }

    if (downloaderInfo.error) {
        logger.error("Downloader info fetch error:", downloaderInfo.error);
        error(500, "Unable to fetch downloader info data");
    }

    // Download activity is supporting detail, not the point of the page --
    // a failure here degrades the section rather than 500-ing the dashboard.
    if (downloads.error) {
        logger.error("Download activity fetch error:", downloads.error);
    }

    return {
        statistics: statistics.data,
        services: svc.data || {},
        downloaderInfo: downloaderInfo.data,
        downloads: downloads.data ?? {
            active: [],
            recent: [],
            page,
            limit: DOWNLOADS_PAGE_SIZE,
            total_active: 0,
            total_pages: 1
        }
    };
}) satisfies PageServerLoad;
