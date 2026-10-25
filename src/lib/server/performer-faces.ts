/**
 * Cast headshots, fetched once, shrunk, and kept on the data volume.
 *
 * Same reasoning as `studio-logos.ts`: hot-linking TPDB's CDN means every
 * device fetches every face from the internet on every visit, and the
 * television cannot reach it at all. Unlike a logo, a face is stored RESIZED.
 * TPDB's `face` is a 500x500 JPEG of ~40 KB (and the fallback `image` is a
 * full poster), drawn on the title page as a ~80px circle. 192x192 WebP is
 * sharp at that size on a 2x screen and comes out around 6-10 KB -- a fifth
 * of the original or less, across a cast list that runs to dozens.
 *
 * Keyed by a hash of the source URL, so a performer whose picture changes on
 * TPDB gets a new key rather than a stale one.
 *
 * The URL comes from the request, so it is checked against TPDB's own image
 * hosts before anything is fetched, and redirects are refused: this route
 * must never be a way to make the server request something on the home
 * network.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { env } from "$env/dynamic/private";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("performer-faces");

const SIZE = 192;
const QUALITY = 72;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const FAILURE_TTL_MS = 6 * 60 * 60 * 1000;
// `thumb.` is TPDB's resizing proxy, which is what `face` points at; `cdn.`
// serves the full `image` fallback.
const ALLOWED_HOSTS = new Set(["cdn.theporndb.net", "thumb.theporndb.net"]);

function directory(): string {
    // Beside the database, which is the volume the deployment already mounts.
    const dir = join(dirname(env.DATABASE_URL ?? "./riven.db"), "cache", "performer-faces");

    mkdirSync(dir, { recursive: true });
    return dir;
}

export function isAllowedFace(url: string): boolean {
    try {
        const parsed = new URL(url);

        return parsed.protocol === "https:" && ALLOWED_HOSTS.has(parsed.hostname);
    } catch {
        return false;
    }
}

/** The address the page puts in `<img src>` for a face URL from TPDB. */
export function faceSrc(url: string | null | undefined): string | null {
    return url && isAllowedFace(url) ? `/performers/face?u=${encodeURIComponent(url)}` : null;
}

function keyFor(url: string): string {
    return createHash("sha1").update(url).digest("hex");
}

function recentlyFailed(dir: string, key: string): boolean {
    try {
        return Date.now() - statSync(join(dir, `${key}.miss`)).mtimeMs < FAILURE_TTL_MS;
    } catch {
        return false;
    }
}

const inFlight = new Map<string, Promise<Buffer | null>>();

async function download(
    dir: string,
    key: string,
    url: string,
    fetch: typeof globalThis.fetch
): Promise<Buffer | null> {
    try {
        const response = await fetch(url, {
            headers: { "user-agent": "Mozilla/5.0 (riven)" },
            signal: AbortSignal.timeout(15_000),
            redirect: "error"
        });

        const type = response.headers.get("content-type") ?? "";

        if (!response.ok || !type.startsWith("image/")) {
            throw new Error(`${response.status} ${type || "no type"}`);
        }

        const source = Buffer.from(await response.arrayBuffer());

        if (source.length === 0 || source.length > MAX_SOURCE_BYTES) {
            throw new Error(`${source.length} bytes`);
        }

        // `attention` crops toward the face when the source is a full-length
        // poster rather than TPDB's already-cropped headshot.
        const body = await sharp(source, { limitInputPixels: 40_000_000 })
            .rotate()
            .resize(SIZE, SIZE, { fit: "cover", position: sharp.strategy.attention })
            .webp({ quality: QUALITY, effort: 5 })
            .toBuffer();

        // Written whole, then renamed: a request that arrives mid-write must
        // never be served half an image.
        const final = join(dir, `${key}.webp`);
        const partial = `${final}.${process.pid}.tmp`;

        writeFileSync(partial, body);
        renameSync(partial, final);

        return body;
    } catch (error) {
        logger.warn(`Face ${url} could not be cached: ${(error as Error).message}`);
        writeFileSync(join(dir, `${key}.miss`), "");

        return null;
    }
}

/** A performer's face as a small WebP: from disk, or fetched, shrunk and stored. */
export async function performerFace(
    url: string,
    fetch: typeof globalThis.fetch
): Promise<Buffer | null> {
    if (!isAllowedFace(url)) return null;

    const dir = directory();
    const key = keyFor(url);
    const file = join(dir, `${key}.webp`);

    if (existsSync(file)) return readFileSync(file);
    if (recentlyFailed(dir, key)) return null;

    // A cast row asks for many faces at once, and two tabs may ask for the
    // same one; they share a single download.
    let pending = inFlight.get(key);

    if (!pending) {
        pending = download(dir, key, url, fetch).finally(() => inFlight.delete(key));
        inFlight.set(key, pending);
    }

    return pending;
}
