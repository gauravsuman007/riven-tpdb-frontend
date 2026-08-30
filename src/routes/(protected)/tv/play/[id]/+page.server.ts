import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { jellyfinEnabled } from "$lib/server/jellyfin/config";
import { issuePlaySession } from "$lib/server/jellyfin/play-sessions";
import { toGuid } from "$lib/utils/jellyfin-ids";

/**
 * The container extension to end the stream URL with, or "mp4" if it cannot
 * be determined -- the same rule the external-player link uses. An unknown
 * container is a worse guess, never a failure.
 */
async function containerFor(
    fetcher: typeof fetch,
    backendUrl: string,
    apiKey: string,
    itemId: number
): Promise<string> {
    try {
        const response = await fetcher(`${backendUrl}/api/v1/stream/playback_info/${itemId}`, {
            headers: { "x-api-key": apiKey }
        });

        if (!response.ok) return "mp4";

        const container = (await response.json())?.probe?.container;
        const first = String(container ?? "").split(",")[0].trim().toLowerCase();

        return /^[a-z0-9]{2,5}$/.test(first) ? first : "mp4";
    } catch {
        return "mp4";
    }
}

/**
 * What this item is called, and whether there is a file at all.
 *
 * `/api/v1/items/{id}` is not a Riven-id lookup -- it takes an external id
 * and a media_type -- so the by-id route that does exist and does answer for
 * every item is the metadata one. It doubles as the availability check: it
 * describes a downloaded file, so no filename means nothing to play yet.
 */
async function fileInfo(
    fetcher: typeof fetch,
    backendUrl: string,
    apiKey: string,
    itemId: number
): Promise<{ filename: string; title: string } | null> {
    try {
        const response = await fetcher(`${backendUrl}/api/v1/items/${itemId}/metadata`, {
            headers: { "x-api-key": apiKey }
        });

        if (!response.ok) return null;

        const data = await response.json();
        const filename = String(data?.filename ?? "");

        if (!filename) return null;

        return { filename, title: String(data?.parsed_title || filename) };
    } catch {
        return null;
    }
}

export const load: PageServerLoad = async (event) => {
    const itemId = Number(event.params.id);

    if (!Number.isInteger(itemId) || itemId <= 0) error(400, "Not a library item");

    /*
        The stream routes live on the Jellyfin surface, so without it there is
        no URL to give the video element -- said plainly rather than 500'd,
        because it is a settings choice and not a fault.
    */
    if (!jellyfinEnabled()) {
        return { ready: false as const, reason: "Playback is off: the Jellyfin surface is disabled.", title: "", src: "", itemId };
    }

    const file = await fileInfo(event.fetch, event.locals.backendUrl, event.locals.apiKey, itemId);

    if (!file) {
        return {
            ready: false as const,
            reason: "This title has not finished downloading yet.",
            title: event.url.searchParams.get("t") ?? "",
            src: "",
            itemId
        };
    }

    const container = await containerFor(
        event.fetch,
        event.locals.backendUrl,
        event.locals.apiKey,
        itemId
    );

    /*
        Relative, unlike the external-player link: this one is consumed by a
        <video> on this very page, and behind the multiplexer an absolute URL
        built from the app's own origin would point past the proxy.
    */
    return {
        ready: true as const,
        title: event.url.searchParams.get("t") || file.title,
        src: `/Videos/${toGuid(itemId)}/stream.${container}?static=true&playSessionId=${issuePlaySession(itemId)}`,
        itemId
    };
};
