/*
Client for the OnlyFans performer index (backend: routers/secure/onlyfans.py).

Hand-written rather than generated, for the same reason `studios.ts` and
`plugins.ts` are: `providers/riven.ts` is generated from the backend's OpenAPI
spec, which needs a running backend to regenerate.

Two halves, and they are reached differently:

  * The account index is database-backed, so a page's `load` reads it
    server-side through `get()` below with an explicit base URL and key.
  * Everything a user clicks -- scraper toggles, a site button on an account
    page, the next page of an infinite scroll -- runs in the browser and goes
    through the `/api/v1/*` proxy route, which injects the key. Those helpers
    take no options.
*/

export interface FetchOptions {
    baseUrl: string;
    apiKey: string;
    fetch: typeof globalThis.fetch;
}

export interface OnlyFansAccount {
    handle: string;
    display_name: string;
    avatar_url: string | null;
    bio: string | null;
    source_count: number;
    saved: boolean;
    sites: string[];
}

export interface OnlyFansAccountSource {
    site: string;
    site_handle: string;
    page_url: string;
    video_count: number | null;
    image_count: number | null;
}

export interface OnlyFansAccountDetail extends OnlyFansAccount {
    sources: OnlyFansAccountSource[];
}

export interface AccountPage {
    items: OnlyFansAccount[];
    /** Matching the filter, not the table size -- an infinite scroll compared
     *  against an unfiltered count would never terminate on a search. */
    total: number;
    offset: number;
    limit: number;
}

export interface OnlyFansVideo {
    site: string;
    video_id: string;
    title: string;
    page_url: string;
    thumbnail: string | null;
    duration: number | null;
    resolution: string | null;
    views: number | null;
    hd: boolean;
}

export interface OnlyFansGallery {
    site: string;
    gallery_id: string;
    title: string;
    page_url: string;
    cover: string | null;
    image_count: number | null;
    posted: string | null;
}

export interface OnlyFansScraper {
    key: string;
    name: string;
    base_url: string;
    enabled: boolean;
    source_file: string;
    indexes_accounts: boolean;
}

export interface OnlyFansPlugins {
    plugin_dir: string;
    scrapers: OnlyFansScraper[];
    /** Filename -> what went wrong. A file that fails to import shows here
     *  rather than silently not existing. */
    errors: Record<string, string>;
}

export interface ImportResult {
    filename: string;
    accepted: boolean;
    key: string | null;
    error: string | null;
}

async function get<T>(path: string, { baseUrl, apiKey, fetch }: FetchOptions): Promise<T | null> {
    try {
        const response = await fetch(`${baseUrl}/api/v1/onlyfans${path}`, {
            headers: { "x-api-key": apiKey }
        });
        if (!response.ok) return null;
        return (await response.json()) as T;
    } catch {
        return null;
    }
}

/** Browser-side GET, through the proxy route that injects the key. */
async function browserGet<T>(path: string): Promise<T | null> {
    try {
        const response = await fetch(`/api/v1/onlyfans${path}`);
        if (!response.ok) return null;
        return (await response.json()) as T;
    } catch {
        return null;
    }
}

async function browserPost<T>(path: string, body?: unknown): Promise<T | null> {
    try {
        const response = await fetch(`/api/v1/onlyfans${path}`, {
            method: "POST",
            ...(body === undefined
                ? {}
                : {
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify(body)
                  })
        });
        if (!response.ok) return null;
        return (await response.json()) as T;
    } catch {
        return null;
    }
}

// --- The index --------------------------------------------------------------

export function listAccounts(
    options: FetchOptions,
    params: { search?: string; limit?: number; offset?: number } = {}
): Promise<AccountPage | null> {
    return get<AccountPage>(`/accounts?${accountQuery(params)}`, options);
}

/** The same listing, from the browser -- used by the search box and by scroll. */
export function browseAccounts(
    params: { search?: string; limit?: number; offset?: number } = {}
): Promise<AccountPage | null> {
    return browserGet<AccountPage>(`/accounts?${accountQuery(params)}`);
}

function accountQuery(params: { search?: string; limit?: number; offset?: number }): string {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set("search", params.search.trim());
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    if (params.offset !== undefined) query.set("offset", String(params.offset));
    return query.toString();
}

export function getAccount(
    handle: string,
    options: FetchOptions
): Promise<OnlyFansAccountDetail | null> {
    return get<OnlyFansAccountDetail>(`/accounts/${encodeURIComponent(handle)}`, options);
}

export function setAccountSaved(handle: string, saved: boolean): Promise<OnlyFansAccount | null> {
    const path = `/accounts/${encodeURIComponent(handle)}/save`;
    if (saved) return browserPost<OnlyFansAccount>(path);
    return fetch(`/api/v1/onlyfans${path}`, { method: "DELETE" })
        .then((r) => (r.ok ? (r.json() as Promise<OnlyFansAccount>) : null))
        .catch(() => null);
}

// --- Live content -----------------------------------------------------------
//
// `null` means the request failed and the caller should say so; an empty array
// means the site genuinely has no more, which is how an infinite scroll knows
// to stop. Collapsing the two would make a dead site look like the end of a
// feed.

export function accountVideos(
    handle: string,
    site: string,
    page: number
): Promise<OnlyFansVideo[] | null> {
    return browserGet<OnlyFansVideo[]>(
        `/accounts/${encodeURIComponent(handle)}/videos?site=${encodeURIComponent(site)}&page=${page}`
    );
}

export function accountGalleries(
    handle: string,
    site: string,
    page: number
): Promise<OnlyFansGallery[] | null> {
    return browserGet<OnlyFansGallery[]>(
        `/accounts/${encodeURIComponent(handle)}/galleries?site=${encodeURIComponent(site)}&page=${page}`
    );
}

export function galleryImages(
    site: string,
    galleryId: string
): Promise<{ index: number; width: number | null; height: number | null }[] | null> {
    return browserGet(`/galleries/${encodeURIComponent(site)}/${encodeURIComponent(galleryId)}`);
}

/**
 * The proxied URL for one image.
 *
 * Images are addressed by position rather than by URL: the real one carries a
 * short-lived token and these hosts check Referer, so an `<img src>` pointed at
 * it would 403 or expire.
 */
export function imageUrl(site: string, galleryId: string, index: number): string {
    return `/api/v1/onlyfans/image?site=${encodeURIComponent(site)}&gallery_id=${encodeURIComponent(galleryId)}&index=${index}`;
}

/** The proxied stream for one rendition of one account video. */
export function streamUrl(site: string, videoId: string, index = 0): string {
    return `/api/v1/onlyfans/stream?site=${encodeURIComponent(site)}&video_id=${encodeURIComponent(videoId)}&index=${index}`;
}

// --- Scraper management -----------------------------------------------------

export function getPlugins(): Promise<OnlyFansPlugins | null> {
    return browserGet<OnlyFansPlugins>("/plugins");
}

export function rescanPlugins(): Promise<OnlyFansPlugins | null> {
    return browserPost<OnlyFansPlugins>("/plugins/rescan");
}

export function setPluginEnabled(key: string, enabled: boolean): Promise<OnlyFansPlugins | null> {
    return browserPost<OnlyFansPlugins>(`/plugins/${encodeURIComponent(key)}/enabled`, { enabled });
}

/**
 * Upload scraper files into the OnlyFans plugin folder.
 *
 * The backend validates each one before keeping it, so a rejected file never
 * reaches the folder -- `results` says which were accepted and why the rest
 * were not.
 */
export async function importPlugins(
    files: FileList | File[]
): Promise<{ results: ImportResult[]; plugins: OnlyFansPlugins } | null> {
    const body = new FormData();
    for (const file of Array.from(files)) body.append("files", file);

    try {
        const response = await fetch("/api/v1/onlyfans/plugins/import", { method: "POST", body });
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

export interface OnlyFansSyncRun {
    site: string;
    /** "running" | "ok" | "failed" | "never" */
    state: string;
    started_at: string | null;
    finished_at: string | null;
    pages: number;
    accounts_seen: number;
    accounts_new: number;
    error: string | null;
    available: boolean;
}

export interface OnlyFansSyncStatus {
    running: boolean;
    sites: OnlyFansSyncRun[];
    accounts: number;
    accounts_with_avatar: number;
}

export function syncStatus(): Promise<OnlyFansSyncStatus | null> {
    return browserGet<OnlyFansSyncStatus>("/sync/status");
}

/**
 * Start an index walk, for one site or for all of them.
 *
 * Returns the reason on failure rather than null, unlike the other helpers
 * here: the interesting case is a 409 saying the site is already being walked,
 * and "sync failed" would describe that as a fault when it is the endpoint
 * refusing to run two walks over one index.
 */
export async function startSync(
    sites?: string[]
): Promise<{ status: OnlyFansSyncStatus } | { error: string }> {
    const query = (sites ?? []).map((s) => `sites=${encodeURIComponent(s)}`).join("&");

    try {
        const response = await fetch(`/api/v1/onlyfans/sync${query ? `?${query}` : ""}`, {
            method: "POST"
        });

        if (!response.ok) {
            const detail = await response
                .json()
                .then((body) => body?.detail)
                .catch(() => null);

            return {
                error: typeof detail === "string" ? detail : `Sync failed (${response.status})`
            };
        }

        return { status: (await response.json()) as OnlyFansSyncStatus };
    } catch {
        return { error: "Could not reach the server" };
    }
}
