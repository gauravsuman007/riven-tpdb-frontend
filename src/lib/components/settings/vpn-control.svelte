<!--
    Live control for the VPN tunnel, alongside the generated settings form.

    The schema form covers the stored settings -- whether the VPN is on, which
    traffic goes through it, where the daemon lives. None of that can log you
    in or pick an exit node, because those are actions against a running
    daemon rather than values to save. That is what this panel is for.

    Status is polled while an interactive login is outstanding, because the
    only signal that the user finished approving the machine in their browser
    is the daemon's state changing.
-->
<script lang="ts">
    import { Button } from "$lib/components/ui/button/index.js";
    import { onDestroy } from "svelte";
    import CheckIcon from "@lucide/svelte/icons/check";
    import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
    import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
    import ShieldIcon from "@lucide/svelte/icons/shield";

    interface ExitNode {
        id: string;
        name: string;
        country: string | null;
        online: boolean;
        active: boolean;
    }

    interface VpnStatus {
        provider: string;
        enabled: boolean;
        connected: boolean;
        state: string;
        detail: string | null;
        auth_url: string | null;
        hostname: string | null;
        exit_node: string | null;
        exit_nodes: ExitNode[];
        route_scraping: boolean;
        route_streaming: boolean;
    }

    let status = $state<VpnStatus | null>(null);
    let busy = $state(false);
    let failure = $state<string | null>(null);
    let authKey = $state("");
    let poller: ReturnType<typeof setInterval> | null = null;

    async function call(path: string, body?: unknown): Promise<void> {
        busy = true;
        failure = null;

        try {
            const response = await fetch(`/api/v1/vpn/${path}`, {
                method: body === undefined && path === "status" ? "GET" : "POST",
                headers: { "content-type": "application/json" },
                body: body === undefined ? undefined : JSON.stringify(body)
            });

            if (!response.ok) throw new Error(`${path} returned ${response.status}`);

            status = await response.json();
        } catch (e) {
            failure = e instanceof Error ? e.message : "Request failed";
        } finally {
            busy = false;
        }
    }

    async function refresh() {
        busy = true;
        failure = null;
        try {
            const response = await fetch("/api/v1/vpn/status");
            if (!response.ok) throw new Error(`Status returned ${response.status}`);
            status = await response.json();
        } catch (e) {
            failure = e instanceof Error ? e.message : "Could not read status";
        } finally {
            busy = false;
        }
    }

    /*
        Only while a login is outstanding. The approval happens in another tab
        on Tailscale's site, so there is no event here to react to -- but
        polling forever afterwards would be a request every few seconds for a
        value that changes about never.
    */
    $effect(() => {
        const waiting = Boolean(status?.auth_url) && !status?.connected;

        if (waiting && poller === null) {
            poller = setInterval(refresh, 3000);
        } else if (!waiting && poller !== null) {
            clearInterval(poller);
            poller = null;
        }
    });

    onDestroy(() => {
        if (poller !== null) clearInterval(poller);
    });

    refresh();

    const stateLabel = $derived.by(() => {
        if (!status) return "Checking…";
        if (status.connected) return "Connected";
        if (status.state === "unreachable") return "Sidecar unreachable";
        if (status.state === "needslogin") return "Not logged in";
        return status.state;
    });
</script>

<div class="border-border/60 bg-muted/30 flex flex-col gap-4 rounded-lg border p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
            <ShieldIcon
                class={status?.connected ? "size-4 text-emerald-500" : "size-4 text-zinc-500"}
                aria-hidden="true" />
            <div class="min-w-0">
                <p class="text-sm font-medium">
                    Tunnel · {stateLabel}
                    {#if status?.hostname}
                        <span class="text-muted-foreground font-mono text-xs">
                            ({status.hostname})
                        </span>
                    {/if}
                </p>
                <p class="text-muted-foreground text-xs">
                    {#if status?.detail}
                        {status.detail}
                    {:else if status?.connected}
                        Routing: {status.route_scraping ? "searches" : ""}{status.route_scraping &&
                        status.route_streaming
                            ? " and "
                            : ""}{status.route_streaming ? "playback" : ""}
                        {#if !status.route_scraping && !status.route_streaming}
                            nothing yet — tick a box below and save.
                        {/if}
                    {:else}
                        Log in to route streaming-site traffic through Tailscale.
                    {/if}
                </p>
            </div>
        </div>

        <div class="flex shrink-0 items-center gap-2">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onclick={refresh}>
                <RotateCcwIcon class="size-4" aria-hidden="true" />
                <span class="sr-only">Refresh status</span>
            </Button>
            {#if status?.connected}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onclick={() => call("disconnect", {})}>
                    Disconnect
                </Button>
            {/if}
        </div>
    </div>

    {#if failure}
        <p class="text-destructive text-xs">{failure}</p>
    {/if}

    {#if status && !status.connected}
        <!--
            Two ways in, because they suit different situations. A reusable
            auth key survives restarts unattended; interactive login needs no
            key management but has to be re-approved when it expires.
        -->
        <div class="flex flex-col gap-3 border-t border-white/10 pt-3">
            {#if status.auth_url}
                <div class="flex flex-wrap items-center gap-2">
                    <Button
                        href={status.auth_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        variant="secondary"
                        size="sm">
                        <ExternalLinkIcon class="mr-2 size-4" aria-hidden="true" />
                        Approve this machine
                    </Button>
                    <span class="text-muted-foreground text-xs">
                        Waiting for approval… this updates itself.
                    </span>
                </div>
            {/if}

            <div class="flex flex-wrap items-end gap-2">
                <label class="flex min-w-0 flex-1 flex-col gap-1">
                    <span class="text-xs font-medium">Auth key (optional)</span>
                    <input
                        type="password"
                        bind:value={authKey}
                        placeholder="tskey-auth-…"
                        autocomplete="off"
                        class="border-border/60 bg-background focus:border-primary/50 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" />
                </label>
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onclick={() => call("connect", { auth_key: authKey || null })}>
                    {authKey ? "Connect with key" : "Log in"}
                </Button>
            </div>
            <p class="text-muted-foreground text-xs">
                Leave the key empty to log in through your browser instead. A key you enter here is
                saved so the tunnel comes back on its own after a restart.
            </p>
        </div>
    {/if}

    {#if status?.connected}
        <div class="flex flex-col gap-2 border-t border-white/10 pt-3">
            <span class="text-xs font-medium">Exit node</span>
            {#if status.exit_nodes.length}
                <select
                    value={status.exit_node ?? ""}
                    disabled={busy}
                    onchange={(e) =>
                        call("exit-node", {
                            node_id: (e.currentTarget as HTMLSelectElement).value || null
                        })}
                    class="border-border/60 bg-background focus:border-primary/50 w-full max-w-sm rounded-lg border px-3 py-2 text-sm focus:outline-none">
                    <option value="">None — leave the tailnet directly</option>
                    {#each status.exit_nodes as node (node.id)}
                        <option value={node.id} disabled={!node.online}>
                            {node.name}{node.country ? ` · ${node.country}` : ""}{node.online
                                ? ""
                                : " (offline)"}
                        </option>
                    {/each}
                </select>
                {#if status.exit_node}
                    <p class="flex items-center gap-1.5 text-xs text-emerald-500">
                        <CheckIcon class="size-3" aria-hidden="true" />
                        Routed traffic leaves from this node.
                    </p>
                {/if}
            {:else}
                <p class="text-muted-foreground text-xs">
                    No machine on your tailnet is advertising itself as an exit node. Traffic still
                    goes through Tailscale, but leaves from this machine.
                </p>
            {/if}
        </div>
    {/if}
</div>
