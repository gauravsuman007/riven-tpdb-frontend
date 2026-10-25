/**
 * Where the page loads a performer's picture from.
 *
 * Through this app, which proxies the backend's TPDB cache: the backend
 * downscales each picture once to a ~6 KB WebP and keeps it inside the TPDB
 * cache, under the same size limit as everything else there. Only TPDB's own
 * image hosts are passed on; the backend checks again before fetching.
 */

const HOSTS = new Set(["cdn.theporndb.net", "thumb.theporndb.net"]);

export function photoSrc(url: string | null | undefined): string | null {
    if (!url) return null;

    try {
        const parsed = new URL(url);

        if (parsed.protocol !== "https:" || !HOSTS.has(parsed.hostname)) return null;
    } catch {
        return null;
    }

    return `/performers/photo?u=${encodeURIComponent(url)}`;
}
