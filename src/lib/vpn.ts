/*
Client-side VPN status, for anything that needs to know how traffic is being
routed before it acts: the direct-search panel (before searching), the stream
results (before offering a Play button), the settings tab's control panel.

Client-side rather than a load function, on purpose. Whether the tunnel is
connected can change between page load and the moment someone clicks a
result -- disconnecting Tailscale from another device, an exit node going
offline -- and this is state a component needs read directly before an
action, not state to bake into the page at render time.
*/

export interface VpnExitNode {
    id: string;
    name: string;
    country: string | null;
    online: boolean;
    active: boolean;
}

export interface VpnStatus {
    provider: string;
    enabled: boolean;
    connected: boolean;
    state: string;
    detail: string | null;
    auth_url: string | null;
    hostname: string | null;
    exit_node: string | null;
    exit_node_name: string | null;
    exit_nodes: VpnExitNode[];
    route_scraping: boolean;
    route_streaming: boolean;
}

export async function getVpnStatus(): Promise<VpnStatus | null> {
    try {
        const response = await fetch("/api/v1/vpn/status");
        if (!response.ok) return null;
        return (await response.json()) as VpnStatus;
    } catch {
        return null;
    }
}

/**
 * One purpose's routing, boiled down to what a button needs to decide.
 *
 * `blocked` is the case that disables things: the purpose IS routed and the
 * tunnel is NOT up. Not routed at all is never blocked -- it just means plain
 * network traffic, which always works.
 */
export interface RouteState {
    routed: boolean;
    connected: boolean;
    blocked: boolean;
    exitNodeName: string | null;
}

export function routeState(status: VpnStatus | null, purpose: "scraping" | "streaming"): RouteState {
    const routed = status ? (purpose === "scraping" ? status.route_scraping : status.route_streaming) : false;
    const connected = status?.connected ?? false;

    return {
        routed,
        connected,
        blocked: routed && !connected,
        exitNodeName: status?.exit_node_name ?? null
    };
}

/** Turn off routing for one purpose. Used by the "disable VPN routing" escape hatch. */
export async function disableRoute(purpose: "scraping" | "streaming"): Promise<boolean> {
    const path = purpose === "scraping" ? "vpn.route_scraping" : "vpn.route_streaming";

    try {
        const response = await fetch(`/api/v1/settings/set/${path}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ [path]: false })
        });
        return response.ok;
    } catch {
        return false;
    }
}
