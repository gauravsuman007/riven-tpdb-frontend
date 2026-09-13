/*
    Add-ons, from the frontend's side.

    Almost nothing here is add-on specific, and that is the point: an add-on
    contributes its navigation entry, its settings tab and its whole API
    without this repository knowing it exists. The one thing that is not free
    is a bespoke *page*, and even that arrives as a compiled bundle the host
    fetches at runtime rather than as source this app has to build.
*/

export interface AddonNav {
    label: string;
    icon: string;
    href: string;
    tv: boolean;
}

/** What the television surface may draw for an add-on. See `AddonTv` in the
 *  backend's `program/addons/contract.py`. Null means no TV presence. */
export interface AddonTv {
    /** Serves `tv/browse`, `tv/detail` and `tv/play`: a screen of its own. */
    browse: boolean;
    /** Serves `tv/title`: a section inside the television's title page. */
    title: boolean;
}

/** One row of cards an add-on offers a page. See `AddonRail` in the
 *  backend's `program/addons/contract.py`. */
export interface AddonRail {
    /** Stable across versions -- it is what a saved layout stores. */
    key: string;
    title: string;
    /** Where it sits before anyone has arranged that page: "own", "home",
     *  "explore" or "none". NOT a restriction: the host's pages offer every
     *  installed rail in their pickers, whatever this says. */
    default_page: string;
    /** Relative to the add-on's own mount, `/api/v1/x/<key>`. */
    endpoint: string;
    description: string;
    tv: boolean;
}

export interface Addon {
    key: string;
    name: string;
    description: string;
    version: string;
    /** "ok" | "disabled" | "failed" -- a failed add-on is still listed, with
     *  its reason. A folder on disk that silently does not appear is the one
     *  outcome nobody can diagnose. */
    state: string;
    error: string | null;
    source: string | null;
    revision: string | null;
    /** True when the remote is ahead of what is installed. `null` means the
     *  check has not run, or ran and could not tell -- rendered as nothing,
     *  never as "up to date", which is a different claim. */
    update_available: boolean | null;
    nav: AddonNav | null;
    tv: AddonTv | null;
    /** Named places in the HOST's pages this add-on fills with a section
     *  of its own, e.g. ["details"]. See `addon-slots.ts`. */
    slots: string[];
    /** "settings", "api", "jobs", "rails", "database", "tv", "slots",
     *  "scrapers". Inferred by the host from what the add-on implements --
     *  except "scrapers", which nothing it can call would reveal, and which
     *  is the one with a consequence rather than a label: it is what routes
     *  the add-on's traffic through the configured VPN. */
    capabilities: string[];
    /** The add-on's rail CATALOGUE -- what may be picked. What a page
     *  actually shows is the layout, at `/api/v1/rails`. A disabled or
     *  failed add-on offers none, which is how its rows leave every page
     *  without their saved positions being touched. */
    rails: AddonRail[];
    settings_schema: Record<string, unknown> | null;
    settings: Record<string, unknown> | null;
    tables: number;
    bytes: number;
    status: Record<string, number | string>;
}

export interface AddonsResponse {
    addons: Addon[];
    directory: string;
}

type Result = { addons: AddonsResponse } | { error: string };

/*
    `f` exists for server-side loads: SvelteKit's own fetch carries the
    request's cookies and resolves a relative URL against this origin, and the
    global one does neither -- so a load using the global fetch would be
    unauthenticated and pointed at nowhere.
*/
async function call(
    path: string,
    init?: RequestInit,
    f: typeof globalThis.fetch = globalThis.fetch
): Promise<Result> {
    try {
        const response = await f(`/api/v1/addons${path}`, init);

        if (!response.ok) {
            const detail = await response
                .json()
                .then((body) => body?.detail)
                .catch(() => null);

            return {
                error: typeof detail === "string" ? detail : `Request failed (${response.status})`
            };
        }

        return { addons: (await response.json()) as AddonsResponse };
    } catch {
        return { error: "Could not reach the server" };
    }
}

export const listAddons = (f?: typeof globalThis.fetch) => call("", undefined, f);
export const rescanAddons = () => call("/rescan", { method: "POST" });

export const installAddon = (url: string, ref?: string, token?: string) =>
    call("/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, ref: ref?.trim() || null, token: token?.trim() || null })
    });

export const updateAddon = (key: string) => call(`/${key}/update`, { method: "POST" });

/** Ask each add-on's git remote whether it has moved on. One network round
 *  trip per add-on, which is why it is a button and not part of listing. */
export const checkAddonUpdates = () => call("/check-updates", { method: "POST" });

export const setAddonEnabled = (key: string, enabled: boolean) =>
    call(`/${key}/enabled?enabled=${enabled}`, { method: "POST" });

/*
    Removing and purging are deliberately one call with a flag rather than two
    endpoints, because they differ by exactly one decision the user makes in
    the dialog: whether the data goes too. `confirm` is required for a purge --
    the backend refuses without it, so a mistyped URL cannot destroy anything.
*/
export const removeAddon = (key: string, purge: boolean) =>
    call(`/${key}?purge=${purge}${purge ? `&confirm=${encodeURIComponent(key)}` : ""}`, {
        method: "DELETE"
    });

/** Where an add-on's compiled page and stylesheet are served from. */
export const addonAsset = (key: string, file: string) => `/api/v1/x/${key}/ui/${file}`;

export function formatBytes(bytes: number): string {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

/*
    SCRAPED VIDEOS BELONG TO AN ADD-ON, so their API lives under the add-on
    prefix rather than at a host route -- and there is more than one add-on
    serving them, so the prefix is derived from a key rather than fixed.

    The host keeps these callers because they are the HOST's player
    infrastructure -- minting a URL an external app can open, and filling in
    the overlay's description. They call an add-on; they are not part of one.
    If the named add-on is not installed the backend answers 404 and each of
    these degrades the way it already does for an unreachable backend.
*/

/** The default owner of a site key, for a caller that does not name one.
 *
 *  Every site key came from the tube scraper before there was a second
 *  add-on serving them, so an unqualified request means that one. */
export const DEFAULT_SCRAPER_ADDON = "tubescraper";

/**
 * The API prefix for one add-on, from its key.
 *
 * The key is a folder name on the backend (see the add-on framework), so it
 * is validated rather than trusted: this builds a URL the server then fetches
 * with the backend API key, and a key carrying `..` or a slash would reach
 * somewhere else entirely. An invalid one falls back to the default rather
 * than throwing -- the caller is a player hand-off, and refusing the whole
 * request over a malformed query parameter would turn a wrong guess into a
 * dead button.
 */
export function addonApi(key: string | null | undefined): string {
    const clean = /^[a-z0-9_-]{1,40}$/.test(key ?? "") ? key : DEFAULT_SCRAPER_ADDON;

    return `/api/v1/x/${clean}`;
}
