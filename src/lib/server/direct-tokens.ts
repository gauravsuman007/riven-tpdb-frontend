/**
 * Short-lived capability tokens for handing a direct-scrape video to another
 * application.
 *
 * THE PROBLEM. The in-page player fetches `/api/direct/stream?...`, which
 * lives under `(protected)` and authenticates with the browser's session
 * cookie. An external player -- MX Player, VLC -- is a different application
 * with no cookie and no way to be given one, so that URL is useless to it:
 * it gets the login page, which is why "open in external player" ended up
 * downloading something in a browser instead of playing.
 *
 * Same shape as `play-sessions.ts`, and the same argument for why it is safe:
 * a token is minted only for a request the session cookie has already
 * authenticated, and is narrower than that session in every dimension -- one
 * video, expiring, useless on any other route.
 */

import { randomBytes } from "node:crypto";

import { RESERVED_BODY_HEX } from "$lib/utils/jellyfin-ids";

/** Long enough to watch something; short enough that a leaked URL dies. */
const TTL_MS = 12 * 60 * 60 * 1000;

/** Bounded so a long-running server cannot accumulate tokens without limit. */
const MAX_TOKENS = 5_000;

interface Grant {
    site: string;
    videoId: string;
    index: string;
    /** Shown by the external player, which has nothing else to name it by. */
    title: string;
    expiresAt: number;
}

const grants = new Map<string, Grant>();

function prune(now: number): void {
    for (const [token, grant] of grants) {
        if (grant.expiresAt <= now) grants.delete(token);
    }

    // Map keeps insertion order, so the head is the least recently minted.
    while (grants.size > MAX_TOKENS) {
        const oldest = grants.keys().next();
        if (oldest.done) break;
        grants.delete(oldest.value);
    }
}

export function mintDirectToken(site: string, videoId: string, index = "0", title = ""): string {
    const now = Date.now();
    prune(now);

    /*
        Sized to what is left of a Jellyfin item id once its reserved prefix
        is spent, because the token IS the id: see `toDirectGuid`. 12 bytes is
        still 96 bits of entropy on a value that expires in twelve hours and
        unlocks exactly one video, which is a far wider margin than the threat
        (someone guessing a URL on a LAN) needs.
    */
    const token = randomBytes(RESERVED_BODY_HEX / 2).toString("hex");

    grants.set(token, { site, videoId, index, title, expiresAt: now + TTL_MS });

    return token;
}

export function resolveDirectToken(token: string | undefined): Grant | null {
    if (!token) return null;

    const grant = grants.get(token);

    if (!grant) return null;

    const now = Date.now();

    if (grant.expiresAt <= now) {
        grants.delete(token);
        return null;
    }

    // Sliding: a long file being read must not expire mid-playback.
    grant.expiresAt = now + TTL_MS;

    return grant;
}
