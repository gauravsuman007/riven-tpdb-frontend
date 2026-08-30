/**
 * Translation between Riven's integer ids and Jellyfin's GUID-shaped ones.
 *
 * Direct port of the backend's `program/services/jellyfin_server/ids.py`,
 * which this replaces (the Jellyfin surface now lives entirely here). Jellyfin
 * clients treat item ids as opaque, but many assume the 32-hex shape a .NET
 * Guid serialises to and mangle or reject anything else. Riven ids are
 * `MediaItem.id` integers, so they are widened into that shape rather than a
 * mapping table being kept: the encoding is reversible, so there is no state
 * to persist, nothing to invalidate, and an id survives a restart.
 */

// Fixed ids for the things that are not library items. Jellyfin wants a GUID
// for the server, the user, and each "view" (the rows on the client's home
// screen); none of those correspond to a row in the database, so they are
// constants rather than derived. Kept identical to the backend's former
// values so nothing a client cached (server id, user id) changes underneath
// it just because the implementation moved repos.
export const SERVER_ID = "72697665-6e74-7064-6200-000000000001";
export const USER_ID = "72697665-6e74-7064-6200-000000000002";
export const LIBRARY_ID = "72697665-6e74-7064-6200-000000000003";

// High bit set, so a synthetic id can never collide with a real MediaItem id
// widened by `toGuid`. Used for People and Studios, which are surfaced as
// browsable entities but are not stored as rows anywhere.
const SYNTHETIC_PREFIX = "ffffffff";

/**
 * Marks an id that stands for a DIRECT-SCRAPE video rather than a library row.
 *
 * A direct-site video has no MediaItem and therefore no integer id, but it
 * still has to be addressable as a Jellyfin item, because that is the only
 * currency the native players accept. Reading ExternalPlayer.kt: initPlayer()
 * takes a PlayOptions carrying `ids` and resolves them through
 * `mediaSourceResolver` -- there is no entry point anywhere on that bridge
 * that accepts a raw media URL.
 *
 * That is why "open in external player" opened a browser instead of a player
 * chooser. The fallback path used NativeInterface.openUrl(), which fires a
 * bare Intent(ACTION_VIEW, uri) with NO MIME type set; Android then resolves
 * an http(s) URI by scheme alone and a browser always wins, so no chooser is
 * ever offered. ExternalPlayer builds its intent with
 * `setDataAndType(uri, "video/*")`, which is precisely what makes the chooser
 * appear -- so the fix is to give the video an id, not a better URL.
 *
 * Distinct from SYNTHETIC_PREFIX because these decode to a capability token
 * rather than a name hash, and the two must never be confused for each other.
 */
const DIRECT_PREFIX = "fffffffe";

/** Every prefix that means "this is not a MediaItem id". */
const RESERVED_PREFIXES = [SYNTHETIC_PREFIX, DIRECT_PREFIX];

/** The 24 hex chars a reserved id has left once its prefix is spent. */
export const RESERVED_BODY_HEX = 24;

/** A Jellyfin item id standing for the direct video this token grants. */
export function toDirectGuid(token: string): string {
    const cleaned = token.replace(/-/g, "").trim().toLowerCase();

    if (!new RegExp(`^[0-9a-f]{${RESERVED_BODY_HEX}}$`).test(cleaned)) {
        throw new Error(`toDirectGuid: not a direct-play token: ${JSON.stringify(token)}`);
    }

    return `${DIRECT_PREFIX}${cleaned}`;
}

/** Recover the direct-play token, or null if this is not a direct video id. */
export function fromDirectGuid(guid: string): string | null {
    const cleaned = guid.replace(/-/g, "").trim().toLowerCase();

    if (!cleaned.startsWith(DIRECT_PREFIX)) return null;

    const body = cleaned.slice(DIRECT_PREFIX.length);

    return new RegExp(`^[0-9a-f]{${RESERVED_BODY_HEX}}$`).test(body) ? body : null;
}

/**
 * Widen a MediaItem id into the 32-hex shape clients expect.
 *
 * TRAP, cost a long debugging cycle: the backend serialises `MediaItem.id`
 * as a STRING ("862"), and several call sites pass it straight through as
 * `riven_id`. `String.prototype.toString()` takes no radix argument and
 * silently ignores one, so `("862").toString(16)` returns "862" unchanged --
 * the decimal id gets zero-padded into a valid-looking GUID that decodes as
 * a completely different number (862 -> ...000862 -> 2146), and every
 * request for it 404s with nothing to suggest an encoding bug. Coercing
 * here rather than trusting the declared `number` type is what makes this
 * safe, because TypeScript cannot enforce it across an HTTP boundary.
 */
export function toGuid(itemId: number | string): string {
    const value = Number(itemId);

    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`toGuid: not a usable MediaItem id: ${JSON.stringify(itemId)}`);
    }

    return value.toString(16).padStart(32, "0");
}

/**
 * Recover a MediaItem id, or null if this is not one of ours.
 *
 * Returns null rather than throwing: the id arrives from a client over the
 * network, and a malformed one is a 404, not a 500.
 */
export function fromGuid(guid: string): number | null {
    const cleaned = guid.replace(/-/g, "").trim().toLowerCase();

    // Checked against EVERY reserved prefix. When this tested only
    // SYNTHETIC_PREFIX, any other reserved namespace would fall through to
    // parseInt() below and decode as an enormous but perfectly finite
    // number -- a valid-looking MediaItem id for a row that cannot exist,
    // which 404s with nothing pointing at the encoding as the cause.
    if (!cleaned || RESERVED_PREFIXES.some((prefix) => cleaned.startsWith(prefix))) {
        return null;
    }

    if (!/^[0-9a-f]+$/.test(cleaned)) {
        return null;
    }

    const value = parseInt(cleaned, 16);

    return Number.isFinite(value) && value !== 0 ? value : null;
}

/**
 * A stable id for a Person or Studio, which have no row of their own.
 *
 * Derived from the name so the same performer keeps the same id across
 * requests and restarts -- clients cache these and will show duplicates if
 * the id moves. Uses SHA-256 rather than the backend's blake2b (Web Crypto
 * has no blake2b), truncated to the same 24 hex chars (12 bytes).
 */
export async function syntheticGuid(kind: string, name: string): Promise<string> {
    const data = new TextEncoder().encode(`${kind}:${name}`.toLowerCase());
    const digest = await crypto.subtle.digest("SHA-256", data);
    const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    return `${SYNTHETIC_PREFIX}${hex.slice(0, 24)}`;
}
