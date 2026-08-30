import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { env } from "$env/dynamic/private";
import { resolveDirectToken } from "$lib/server/direct-tokens";

/**
 * A direct-scrape video, addressed so another Android app can actually open it.
 *
 * Two things about this URL are load-bearing, and neither is cosmetic.
 *
 * 1. IT CARRIES ITS OWN AUTHORISATION. Deliberately outside `(protected)`:
 *    the caller is a different application with no session cookie. The token
 *    in the path is the credential, minted from an already-authenticated
 *    request (see `direct-tokens.ts`).
 *
 * 2. IT ENDS IN A REAL VIDEO EXTENSION. jellyfin-android hands the URL to
 *    `Intent(ACTION_VIEW, uri)` with NO MIME type set
 *    (ActivityEventHandler.kt), so Android has only the URL to resolve
 *    against. Video players register intent filters on path patterns like
 *    `.*\\.mp4`; a query-string URL with no extension matches none of them, so
 *    the only handler left is the browser -- which is why this previously
 *    opened a download instead of a player chooser.
 */
/**
 * The upstream URL, when the caller may fetch it themselves.
 *
 * Returns null whenever it must be proxied instead -- the backend decides,
 * because only it knows what the resolved source requires (see
 * `/api/v1/direct/handoff`). Never throws: an unreachable or unhappy backend
 * means "proxy it", which is the behaviour that always works.
 */
async function upstreamUrl(
    fetcher: typeof fetch,
    grant: { site: string; videoId: string; index: string }
): Promise<string | null> {
    try {
        const target =
            `${env.BACKEND_URL}/api/v1/direct/handoff` +
            `?site=${encodeURIComponent(grant.site)}` +
            `&video_id=${encodeURIComponent(grant.videoId)}` +
            `&index=${encodeURIComponent(grant.index)}`;

        const response = await fetcher(target, {
            headers: { "x-api-key": env.BACKEND_API_KEY ?? "" }
        });

        if (!response.ok) return null;

        return ((await response.json()) as { url?: string | null }).url ?? null;
    } catch {
        return null;
    }
}

export const GET: RequestHandler = async ({ params, request, fetch }) => {
    const grant = resolveDirectToken(params.token);

    if (!grant) error(404, "This link has expired");

    /*
        Send the player to the CDN when it can go there itself.

        Proxying costs two extra hops -- player to here, here to the backend,
        backend to the CDN -- and a seek pays all of them again on every range
        request. That is the whole of why an external player felt slow next to
        the in-page one, which is watching a stream that is already warm.

        A 302 keeps the parts that are load-bearing: the chooser still comes
        from ExternalPlayer.initPlayer() by id, which redirects here, and the
        extension is still in this path. Only the bytes change route.

        `null` means the source needs something we cannot expect a foreign
        player to send (a Referer, usually) or that playback is routed through
        the VPN -- in which case nothing is handed out and the proxy below
        does its original job.
    */
    const direct = await upstreamUrl(fetch, grant);

    if (direct) {
        return new Response(null, { status: 302, headers: { location: direct } });
    }

    const target =
        `${env.BACKEND_URL}/api/v1/direct/stream` +
        `?site=${encodeURIComponent(grant.site)}` +
        `&video_id=${encodeURIComponent(grant.videoId)}` +
        `&index=${encodeURIComponent(grant.index)}`;

    const headers: HeadersInit = { "x-api-key": env.BACKEND_API_KEY ?? "" };
    const range = request.headers.get("range");

    // Forwarded so the player can seek. Without it a range request is
    // answered 200-with-everything, and players that seek before playing
    // simply fail.
    if (range) headers["Range"] = range;

    let upstream: Response;

    try {
        upstream = await fetch(target, { headers });
    } catch {
        error(502, "Could not reach the source");
    }

    if (!upstream.ok && upstream.status !== 206) {
        error(upstream.status, "Source refused the request");
    }

    const out = new Headers();

    for (const name of [
        "content-type",
        "content-length",
        "content-range",
        "accept-ranges",
        "cache-control"
    ]) {
        const value = upstream.headers.get(name);
        if (value) out.set(name, value);
    }

    // Some of these CDNs answer application/octet-stream, which Android treats
    // as a download rather than media. The extension in the path already says
    // what this is; say it in the header too.
    if (!out.has("content-type") || out.get("content-type") === "application/octet-stream") {
        out.set("content-type", "video/mp4");
    }

    if (!out.has("accept-ranges")) out.set("accept-ranges", "bytes");

    return new Response(upstream.body, {
        status: upstream.status,
        headers: out
    });
};
