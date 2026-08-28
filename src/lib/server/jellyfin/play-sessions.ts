/**
 * Short-lived capability tokens for stream URLs.
 *
 * THE PROBLEM THIS SOLVES, confirmed against jellyfin-android v2.7.1 source
 * and then reproduced against the live server:
 *
 * When the external-player path builds a URL for VLC/MX Player, it calls
 * `videosApi.getVideoStreamUrl(...)` (ExternalPlayer.kt:120) and that goes
 * through `ApiClient.createUrl()`, which is *only* baseUrl + path + the query
 * parameters it was handed. It injects no `api_key`, and none of the encoding
 * parameters carry one either. So the URL the app hands to a completely
 * separate application is:
 *
 *     /Videos/{id}/stream?static=true&mediaSourceId=...&playSessionId=...
 *
 * with no credentials at all. MX Player has no Jellyfin session, cannot add
 * one, and our route required auth -- so it got a 401 and reported "can't
 * play this file", which is the only thing it can say about a URL it was
 * refused.
 *
 * The fix cannot be "drop auth on the stream route": that publishes the whole
 * library to anything that can reach the port. What the URL *does* carry is
 * `playSessionId`, which we issued from `/Items/{id}/PlaybackInfo` -- and that
 * call was authenticated. So possession of a play-session id already proves a
 * recent authenticated request for that specific item. Treating it as a
 * capability token is therefore not a weakening: it is narrower than the API
 * key in every dimension (one item, expiring, useless for any other route).
 */

/** Long enough to watch something without the URL dying mid-playback. */
const TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Bound so a long-running server cannot accumulate sessions without limit.
 * Well above any plausible number of concurrent streams.
 */
const MAX_SESSIONS = 5_000;

type Session = { rivenId: number; expiresAt: number };

const sessions = new Map<string, Session>();

function prune(now: number): void {
    for (const [token, session] of sessions) {
        if (session.expiresAt <= now) sessions.delete(token);
    }

    // Still oversized after pruning: drop oldest-first. Map preserves
    // insertion order, so the head is the least recently issued.
    while (sessions.size > MAX_SESSIONS) {
        const oldest = sessions.keys().next();
        if (oldest.done) break;
        sessions.delete(oldest.value);
    }
}

/** Mint a play-session id for an item, for a caller we have just authenticated. */
export function issuePlaySession(rivenId: number): string {
    const now = Date.now();
    prune(now);

    const token = crypto.randomUUID().replace(/-/g, "");
    sessions.set(token, { rivenId, expiresAt: now + TTL_MS });

    return token;
}

/**
 * Whether this token was issued for this item and is still valid.
 *
 * The item is part of the check on purpose: a token for one item must not
 * unlock another, or it would be an API key with extra steps.
 */
export function isValidPlaySession(token: string | null, rivenId: number): boolean {
    if (!token) return false;

    const session = sessions.get(token);

    if (!session) return false;

    const now = Date.now();

    if (session.expiresAt <= now) {
        sessions.delete(token);
        return false;
    }

    if (session.rivenId !== rivenId) return false;

    // Sliding expiry: a stream being actively read should not expire under
    // the player part-way through a long file.
    session.expiresAt = now + TTL_MS;

    return true;
}
