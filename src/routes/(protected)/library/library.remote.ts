import { command } from "$app/server";
import { z } from "zod";
import providers from "$lib/providers";
import { getRequestEvent } from "$app/server";
import { EMPTY_SUGGESTIONS, getSuggestions, type Suggestions } from "$lib/suggestions";

const itemIdsSchema = z.object({
    ids: z.array(z.string())
});

export const reset_items = command(itemIdsSchema, async ({ ids }) => {
    const event = getRequestEvent();
    if (!event) throw new Error("No event found");

    // We need to access locals for auth
    const { backendUrl, apiKey } = event.locals;

    if (!backendUrl || !apiKey) {
        throw new Error("Backend URL or API key missing");
    }

    const res = await providers.riven.POST("/api/v1/items/reset", {
        body: { ids },
        baseUrl: backendUrl,
        headers: {
            "x-api-key": apiKey
        }
    });

    if (res.error) {
        throw new Error(res.error as string);
    }

    return { success: true, count: ids.length };
});

export const retry_items = command(itemIdsSchema, async ({ ids }) => {
    const event = getRequestEvent();
    if (!event) throw new Error("No event found");

    const { backendUrl, apiKey } = event.locals;

    if (!backendUrl || !apiKey) {
        throw new Error("Backend URL or API key missing");
    }

    const res = await providers.riven.POST("/api/v1/items/retry", {
        body: { ids },
        baseUrl: backendUrl,
        headers: {
            "x-api-key": apiKey
        }
    });

    if (res.error) {
        throw new Error(res.error as string);
    }

    return { success: true, count: ids.length };
});

export const remove_items = command(itemIdsSchema, async ({ ids }) => {
    const event = getRequestEvent();
    if (!event) throw new Error("No event found");

    const { backendUrl, apiKey } = event.locals;

    if (!backendUrl || !apiKey) {
        throw new Error("Backend URL or API key missing");
    }

    const res = await providers.riven.DELETE("/api/v1/items/remove", {
        body: { ids },
        baseUrl: backendUrl,
        headers: {
            "x-api-key": apiKey
        }
    });

    if (res.error) {
        throw new Error(res.error as string);
    }

    return { success: true, count: ids.length };
});

/**
 * Search suggestions for the library search box.
 *
 * A remote command rather than a load: it fires per keystroke and must not
 * re-run the page's data load. The backend answers from the library only, so
 * this is a local database query however fast the user types.
 */
export const suggest = command(
    z.object({ q: z.string().min(2) }),
    async ({ q }): Promise<Suggestions> => {
        const event = getRequestEvent();
        if (!event) throw new Error("No event found");

        const { backendUrl, apiKey } = event.locals;

        if (!backendUrl || !apiKey) {
            return EMPTY_SUGGESTIONS;
        }

        return getSuggestions(q, { baseUrl: backendUrl, apiKey, fetch: event.fetch });
    }
);
