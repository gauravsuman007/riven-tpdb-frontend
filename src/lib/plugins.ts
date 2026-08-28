/*
Client for the direct-scrape plugin registry (backend: routers/secure/direct.py
`/direct/plugins*`). Separate from the generated settings client for the same
reason the VPN tab has its own (`vpn.ts`): which scrapers are switched on is a
live toggle against a running registry, not a value the generic form can
express -- the folder can gain a new file at any time, independent of any
settings save.
*/

export interface ScraperInfo {
    key: string;
    name: string;
    base_url: string;
    kind: "builtin" | "plugin";
    enabled: boolean;
    source_file: string | null;
    error: string | null;
}

export interface PluginsStatus {
    plugin_dir: string;
    scrapers: ScraperInfo[];
    /** Stated display order, best first. Empty means built-in defaults apply. */
    site_order: string[];
}

export async function getPlugins(): Promise<PluginsStatus | null> {
    try {
        const response = await fetch("/api/v1/direct/plugins");
        if (!response.ok) return null;
        return (await response.json()) as PluginsStatus;
    } catch {
        return null;
    }
}

/** Re-scan the plugin folder and rebuild the live scraper registry. */
export async function rescanPlugins(): Promise<PluginsStatus | null> {
    try {
        const response = await fetch("/api/v1/direct/plugins/rescan", { method: "POST" });
        if (!response.ok) return null;
        return (await response.json()) as PluginsStatus;
    } catch {
        return null;
    }
}

export async function setPluginEnabled(key: string, enabled: boolean): Promise<PluginsStatus | null> {
    try {
        const response = await fetch(
            `/api/v1/direct/plugins/${encodeURIComponent(key)}/enabled`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ enabled })
            }
        );
        if (!response.ok) return null;
        return (await response.json()) as PluginsStatus;
    } catch {
        return null;
    }
}

/**
 * Set the order results are displayed in, best first.
 *
 * The whole list is sent rather than a "move up" instruction, so the server
 * never has to reconstruct what the user was looking at -- and two tabs open
 * on this page cannot interleave two half-applied moves.
 */
export async function setPluginOrder(order: string[]): Promise<PluginsStatus | null> {
    try {
        const response = await fetch("/api/v1/direct/plugins/order", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ order })
        });
        if (!response.ok) return null;
        return (await response.json()) as PluginsStatus;
    } catch {
        return null;
    }
}
