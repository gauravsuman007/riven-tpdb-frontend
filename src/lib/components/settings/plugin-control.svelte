<!--
    Live control for the direct-scrape plugin registry, alongside the
    (mostly-hidden -- see settings/visibility.py) generic form for this
    section.

    "Which scrapers are enabled" is a toggle against a live registry, not a
    value to save: the plugin folder can gain a new file at any time from
    outside this page entirely (someone copying a .py file onto the server),
    so this polls for a fresh list rather than trusting whatever was true
    when the tab was opened.
-->
<script lang="ts">
    import { onDestroy } from "svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
    import CircleAlertIcon from "@lucide/svelte/icons/circle-alert";
    import PuzzleIcon from "@lucide/svelte/icons/puzzle";
    import {
        getPlugins,
        rescanPlugins,
        setPluginEnabled,
        type PluginsStatus
    } from "$lib/plugins";

    let status = $state<PluginsStatus | null>(null);
    let busyKey = $state<string | null>(null);
    let rescanning = $state(false);
    let failure = $state<string | null>(null);

    async function refresh() {
        const next = await getPlugins();
        if (next) {
            status = next;
            failure = null;
        } else {
            failure = "Could not read the plugin registry";
        }
    }

    async function rescan() {
        rescanning = true;
        const next = await rescanPlugins();
        if (next) {
            status = next;
            failure = null;
        } else {
            failure = "Rescan failed";
        }
        rescanning = false;
    }

    async function toggle(key: string, enabled: boolean) {
        busyKey = key;
        const next = await setPluginEnabled(key, enabled);
        if (next) {
            status = next;
            failure = null;
        } else {
            failure = `Could not switch ${key} ${enabled ? "on" : "off"}`;
        }
        busyKey = null;
    }

    // A dropped-in file has no event to announce itself, so this notices one
    // the same way the VPN panel notices a completed login: by asking again
    // every few seconds. Cheap -- a handful of files on local disk, not a
    // network call -- so there is little cost to polling whether or not the
    // tab is actually being watched.
    const poller = setInterval(refresh, 5000);
    onDestroy(() => clearInterval(poller));

    refresh();

    const builtins = $derived(status?.scrapers.filter((s) => s.kind === "builtin") ?? []);
    const plugins = $derived(status?.scrapers.filter((s) => s.kind === "plugin") ?? []);
</script>

<div class="border-border/60 bg-muted/30 flex flex-col gap-4 rounded-lg border p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
            <PuzzleIcon class="size-4 text-muted-foreground" aria-hidden="true" />
            <div class="min-w-0">
                <p class="text-sm font-medium">Direct-scrape scrapers</p>
                <p class="text-muted-foreground text-xs">
                    Built-in sites, plus anything dropped into
                    <code class="rounded bg-background px-1 py-0.5 font-mono text-[11px]">
                        {status?.plugin_dir ?? "…"}
                    </code>
                    (mapped from a host folder in docker-compose.yml).
                </p>
            </div>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={rescanning} onclick={rescan}>
            <RotateCcwIcon class="mr-2 size-4 {rescanning ? 'animate-spin' : ''}" aria-hidden="true" />
            Rescan folder
        </Button>
    </div>

    {#if failure}
        <p class="text-destructive text-xs">{failure}</p>
    {/if}

    <div class="flex flex-col gap-2">
        <span class="text-xs font-medium text-muted-foreground">Built-in</span>
        {#each builtins as scraper (scraper.key)}
            <div class="border-border/60 bg-background/60 flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div class="min-w-0">
                    <p class="truncate text-sm font-medium">{scraper.name}</p>
                    <p class="text-muted-foreground truncate text-xs font-mono">{scraper.base_url}</p>
                </div>
                <Switch
                    checked={scraper.enabled}
                    disabled={busyKey === scraper.key}
                    onCheckedChange={(v: boolean) => toggle(scraper.key, v)} />
            </div>
        {/each}
    </div>

    <div class="flex flex-col gap-2 border-t border-white/10 pt-3">
        <span class="text-xs font-medium text-muted-foreground">
            Plugins ({plugins.filter((p) => !p.error).length})
        </span>
        {#if plugins.length === 0}
            <p class="text-muted-foreground text-xs">
                No plugin files found. Copy a scraper .py file into the folder above and click
                "Rescan folder" -- see the README for the interface it needs to implement.
            </p>
        {/if}
        {#each plugins as scraper (scraper.source_file ?? scraper.key)}
            {#if scraper.error}
                <div class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2">
                    <CircleAlertIcon class="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
                    <div class="min-w-0">
                        <p class="truncate text-sm font-medium">{scraper.source_file}</p>
                        <p class="text-destructive text-xs">{scraper.error}</p>
                    </div>
                </div>
            {:else}
                <div class="border-border/60 bg-background/60 flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                    <div class="min-w-0">
                        <p class="truncate text-sm font-medium">{scraper.name}</p>
                        <p class="text-muted-foreground truncate text-xs font-mono">
                            {scraper.source_file} · {scraper.base_url}
                        </p>
                    </div>
                    <Switch
                        checked={scraper.enabled}
                        disabled={busyKey === scraper.key}
                        onCheckedChange={(v: boolean) => toggle(scraper.key, v)} />
                </div>
            {/if}
        {/each}
    </div>
</div>
