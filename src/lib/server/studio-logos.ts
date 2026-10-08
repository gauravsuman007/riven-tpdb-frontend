/**
 * Studio logos, fetched once and kept on the data volume.
 *
 * They used to be hot-linked straight from TPDB's CDN: 450 images, up to
 * 3,300px wide and 220 KB each, fetched from the internet on every visit by
 * every device -- the television included, which cannot reach it at all --
 * and drawn cross-origin, so nothing on the page could even look at one.
 *
 * Now `/studios/<id>/logo` answers from `<data dir>/cache/studio-logos`,
 * which is the mounted volume the database lives on, so a logo is downloaded
 * once and survives a container rebuild. Served same-origin, which is also
 * what lets the page measure a logo and put a light plate behind the black
 * ones that vanish on the dark card.
 *
 * The URL fetched is NEVER taken from the request. The route asks the backend
 * for the studio and fetches that studio's own logo, and only from TPDB's
 * CDN: a route that fetched whatever it was handed would be a way to make
 * this server request anything on the home network.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { env } from "$env/dynamic/private";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("studio-logos");

const MAX_BYTES = 2 * 1024 * 1024;
const FAILURE_TTL_MS = 6 * 60 * 60 * 1000;
const ALLOWED_HOSTS = new Set(["cdn.theporndb.net"]);
const EXTENSIONS: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg"
};
const TYPES = Object.fromEntries(Object.entries(EXTENSIONS).map(([type, ext]) => [ext, type]));

export interface CachedLogo {
    body: Buffer;
    type: string;
}

function directory(): string {
    // Beside the database, which is the volume the deployment already mounts.
    const dir = join(dirname(env.DATABASE_URL ?? "./riven.db"), "cache", "studio-logos");

    mkdirSync(dir, { recursive: true });
    return dir;
}

/** A short, stable token for a logo URL: the page puts it in `?v=` so a changed logo is a new URL. */
export function logoVersion(url: string): string {
    return createHash("sha1").update(url).digest("hex").slice(0, 8);
}

function keyFor(studioId: number, url: string): string {
    return `${studioId}-${logoVersion(url)}`;
}

function isAllowed(url: string): boolean {
    try {
        const parsed = new URL(url);

        return parsed.protocol === "https:" && ALLOWED_HOSTS.has(parsed.hostname);
    } catch {
        return false;
    }
}

function fromDisk(dir: string, key: string): CachedLogo | null {
    for (const ext of Object.keys(TYPES)) {
        const file = join(dir, `${key}.${ext}`);

        if (existsSync(file)) return { body: readFileSync(file), type: TYPES[ext] };
    }

    return null;
}

/** A recent failure, so a logo that is gone is not re-requested on every page view. */
function recentlyFailed(dir: string, key: string): boolean {
    const marker = join(dir, `${key}.miss`);

    try {
        return Date.now() - statSync(marker).mtimeMs < FAILURE_TTL_MS;
    } catch {
        return false;
    }
}

const inFlight = new Map<string, Promise<CachedLogo | null>>();

async function download(
    dir: string,
    key: string,
    url: string,
    fetch: typeof globalThis.fetch
): Promise<CachedLogo | null> {
    try {
        const response = await fetch(url, {
            headers: { "user-agent": "Mozilla/5.0 (riven)" },
            signal: AbortSignal.timeout(15_000),
            redirect: "error"
        });

        const type = (response.headers.get("content-type") ?? "")
            .split(";")[0]
            .trim()
            .toLowerCase();
        const ext = EXTENSIONS[type];

        if (!response.ok || !ext) throw new Error(`${response.status} ${type || "no type"}`);

        const body = Buffer.from(await response.arrayBuffer());

        if (body.length === 0 || body.length > MAX_BYTES) throw new Error(`${body.length} bytes`);

        // Written whole, then renamed: a request that arrives mid-write must
        // never be served half a PNG.
        const final = join(dir, `${key}.${ext}`);
        const partial = `${final}.${process.pid}.tmp`;

        writeFileSync(partial, body);
        renameSync(partial, final);

        return { body, type };
    } catch (error) {
        logger.warn(`Logo ${url} could not be cached: ${(error as Error).message}`);
        writeFileSync(join(dir, `${key}.miss`), "");

        return null;
    }
}

/**
 * The logo for one studio: from disk if it is there, otherwise fetched,
 * stored and returned. Null when the studio has none or it cannot be had.
 */
export async function studioLogo(
    studioId: number,
    logoUrl: string | null,
    fetch: typeof globalThis.fetch
): Promise<CachedLogo | null> {
    if (!logoUrl || !isAllowed(logoUrl)) return null;

    const dir = directory();
    const key = keyFor(studioId, logoUrl);
    const known = fromDisk(dir, key);

    if (known) return known;
    if (recentlyFailed(dir, key)) return null;

    // Several tiles asking for the same logo at once share one download.
    let pending = inFlight.get(key);

    if (!pending) {
        pending = download(dir, key, logoUrl, fetch).finally(() => inFlight.delete(key));
        inFlight.set(key, pending);
    }

    return pending;
}
