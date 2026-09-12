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
    nav: AddonNav | null;
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

export const installAddon = (url: string, ref?: string) =>
    call("/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, ref: ref?.trim() || null })
    });

export const updateAddon = (key: string) => call(`/${key}/update`, { method: "POST" });

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
