import { command } from "$app/server";
import { z } from "zod";
import providers from "$lib/providers";
import { getRequestEvent } from "$app/server";

const itemIdsSchema = z.object({
    ids: z.array(z.string())
});

function backend() {
    const event = getRequestEvent();
    if (!event) throw new Error("No event found");

    const { backendUrl, apiKey } = event.locals;
    if (!backendUrl || !apiKey) throw new Error("Backend URL or API key missing");

    return { backendUrl, apiKey };
}

export const pause_downloads = command(itemIdsSchema, async ({ ids }) => {
    const { backendUrl, apiKey } = backend();

    const res = await providers.riven.POST("/api/v1/items/pause", {
        body: { ids },
        baseUrl: backendUrl,
        headers: { "x-api-key": apiKey }
    });

    if (res.error) throw new Error(res.error as string);
    return { success: true, count: ids.length };
});

export const unpause_downloads = command(itemIdsSchema, async ({ ids }) => {
    const { backendUrl, apiKey } = backend();

    const res = await providers.riven.POST("/api/v1/items/unpause", {
        body: { ids },
        baseUrl: backendUrl,
        headers: { "x-api-key": apiKey }
    });

    if (res.error) throw new Error(res.error as string);
    return { success: true, count: ids.length };
});

export const cancel_downloads = command(itemIdsSchema, async ({ ids }) => {
    const { backendUrl, apiKey } = backend();

    const res = await providers.riven.DELETE("/api/v1/items/remove", {
        body: { ids },
        baseUrl: backendUrl,
        headers: { "x-api-key": apiKey }
    });

    if (res.error) throw new Error(res.error as string);
    return { success: true, count: ids.length };
});

// Queue-wide: the backend computes the id set itself from the current active
// states, so these take no body -- acting on a stale client-side list would
// race with whatever the dashboard is showing right now.

export const pause_all_downloads = command(async () => {
    const { backendUrl, apiKey } = backend();

    const res = await providers.riven.POST("/api/v1/items/downloads/pause_all", {
        baseUrl: backendUrl,
        headers: { "x-api-key": apiKey }
    });

    if (res.error) throw new Error(res.error as string);
    return res.data;
});

export const resume_all_downloads = command(async () => {
    const { backendUrl, apiKey } = backend();

    const res = await providers.riven.POST("/api/v1/items/downloads/resume_all", {
        baseUrl: backendUrl,
        headers: { "x-api-key": apiKey }
    });

    if (res.error) throw new Error(res.error as string);
    return res.data;
});

export const cancel_all_downloads = command(async () => {
    const { backendUrl, apiKey } = backend();

    const res = await providers.riven.DELETE("/api/v1/items/downloads/cancel_all", {
        baseUrl: backendUrl,
        headers: { "x-api-key": apiKey }
    });

    if (res.error) throw new Error(res.error as string);
    return res.data;
});
