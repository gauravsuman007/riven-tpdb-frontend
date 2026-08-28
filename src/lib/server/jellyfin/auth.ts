/**
 * Authentication for the Jellyfin-compatible surface.
 *
 * Direct port of the backend's former `program/services/jellyfin_server/auth.py`.
 * Deliberately NOT a second credential store: the one secret is
 * `BACKEND_API_KEY` (env), and this maps Jellyfin's username/password
 * handshake onto it -- the configured username plus the API key as the
 * password. A client that authenticates therefore proves it already knew the
 * API key, so the token it gets back can simply BE that key: no session
 * table, nothing to expire, nothing lost across a restart, and no way for
 * this path to grant access the existing one would not.
 *
 * On header formats: we are the SERVER, so we do not choose what the client
 * sends. Jellyfin 10.11 deprecated the `X-Emby-*` forms in favour of
 * `Authorization: MediaBrowser ...`, but that deprecation targets client
 * authors and TV apps update slowly or never -- every historical form is
 * accepted here, permanently.
 */

import { jellyfinUsername } from "./config";

export interface ClientIdentity {
    token: string | null;
    client: string | null;
    device: string | null;
    deviceId: string | null;
    version: string | null;
}

const EMPTY_IDENTITY: ClientIdentity = {
    token: null,
    client: null,
    device: null,
    deviceId: null,
    version: null
};

// `MediaBrowser Token="abc", Client="Android TV", Version="0.15"`. Values are
// quoted and may contain commas and spaces, so this pulls out quoted pairs
// rather than splitting the string.
const PAIR_RE = /(\w+)\s*=\s*"([^"]*)"/g;

/** Read a MediaBrowser-scheme header into its parts. Never throws. */
export function parseAuthorization(raw: string | null): ClientIdentity {
    if (!raw) return EMPTY_IDENTITY;

    const values: Record<string, string> = {};
    let match: RegExpExecArray | null;

    // Reset lastIndex since the regex has the global flag and is module-scoped.
    PAIR_RE.lastIndex = 0;

    while ((match = PAIR_RE.exec(raw)) !== null) {
        values[match[1].toLowerCase()] = match[2];
    }

    return {
        token: values.token || null,
        client: values.client || null,
        device: values.device || null,
        deviceId: values.deviceid || null,
        version: values.version || null
    };
}

/** Pull the caller's identity out of whichever header/query form they used. */
export function identify(headers: Headers, query: URLSearchParams): ClientIdentity {
    const identity = parseAuthorization(
        headers.get("authorization") || headers.get("x-emby-authorization")
    );

    if (identity.token) return identity;

    // The bare-token headers carry no client metadata, so keep whatever the
    // MediaBrowser header told us about the device and fill in just the token.
    const token =
        headers.get("x-emby-token") ||
        headers.get("x-mediabrowser-token") ||
        // Discouraged, but some clients (and every "test it with curl") use it.
        query.get("ApiKey") ||
        query.get("api_key");

    if (!token) return identity;

    return { ...identity, token };
}

/** Constant-time-ish check against the one secret this server has. */
export function isValidToken(token: string | null, apiKey: string): boolean {
    if (!token || !apiKey) return false;

    return timingSafeEqual(token, apiKey);
}

/** Validate an AuthenticateByName attempt. */
export function checkPassword(username: string, password: string, apiKey: string): boolean {
    if (!apiKey) return false;

    if ((username || "").trim().toLowerCase() !== jellyfinUsername().trim().toLowerCase()) {
        return false;
    }

    return timingSafeEqual(password || "", apiKey);
}

/**
 * The token handed to a client that just authenticated: the API key itself.
 * The client necessarily supplied it as the password a moment ago, so this
 * grants nothing new, and it means tokens survive restarts.
 */
export function issueToken(apiKey: string): string {
    return apiKey;
}

function timingSafeEqual(a: string, b: string): boolean {
    const encoder = new TextEncoder();
    const aBytes = encoder.encode(a);
    const bBytes = encoder.encode(b);

    if (aBytes.length !== bBytes.length) {
        // Still walk a fixed number of bytes so length alone leaks less.
        for (let i = 0; i < Math.max(aBytes.length, bBytes.length); i++) {
            void ((aBytes[i] ?? 0) ^ (bBytes[i] ?? 0));
        }
        return false;
    }

    let diff = 0;
    for (let i = 0; i < aBytes.length; i++) {
        diff |= aBytes[i] ^ bBytes[i];
    }

    return diff === 0;
}
