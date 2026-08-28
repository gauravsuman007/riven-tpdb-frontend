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
    import ChevronUpIcon from "@lucide/svelte/icons/chevron-up";
    import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
    import {
        getPlugins,
        rescanPlugins,
        setPluginEnabled,
        setPluginOrder,
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

    /**
     * Every working scraper in the order its results appear.
     *
     * Sites the user has placed come first in their stated order; everything
     * else follows, so a newly-dropped plugin appears at the bottom rather
     * than silently landing above a deliberate choice. Broken plugin files
     * are left out -- they produce no results to order.
     */
    const ordered = $derived.by(() => {
        const usable = (status?.scrapers ?? []).filter((s) => !s.error);
        const stated = status?.site_order ?? [];
        const byKey = new Map(usable.map((s) => [s.key, s]));

        const placed = stated.map((key) => byKey.get(key)).filter((s) => s !== undefined);
        const placedKeys = new Set(placed.map((s) => s!.key));

        return [...placed, ...usable.filter((s) => !placedKeys.has(s.key))];
    });

    let reordering = $state(false);

    async function move(index: number, delta: number) {
        const next = ordered.map((s) => s!.key);
        const target = index + delta;

        if (target < 0 || target >= next.length) return;

        [next[index], next[target]] = [next[target], next[index]];

        reordering = true;
        const result = await setPluginOrder(next);

        if (result) {
            status = result;
            failure = null;
        } else {
            failure = "Could not save the scraper order";
        }
        reordering = false;
    }
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

    <!--
        Order is a separate list from the on/off switches above on purpose:
        it spans built-ins and plugins together (the whole point is being able
        to put a plugin above a built-in), and mixing a cross-cutting ordered
        list into two type-grouped lists would make neither readable.
    -->
    <div class="flex flex-col gap-2 border-t border-white/10 pt-3">
        <div class="min-w-0">
            <span class="text-xs font-medium text-muted-foreground">Result order</span>
            <p class="text-muted-foreground text-xs">
                Results appear in this order, best site first. A site higher in this list always
                comes first, whatever the individual results' relevance scores say.
            </p>
        </div>
        {#each ordered as scraper, index (scraper!.key)}
            <div class="border-border/60 bg-background/60 flex items-center gap-3 rounded-lg border px-3 py-2">
                <span
                    class="text-muted-foreground w-5 shrink-0 text-right font-mono text-xs tabular-nums">
                    {index + 1}
                </span>
                <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium">
                        {scraper!.name}
                        {#if !scraper!.enabled}
                            <span class="text-muted-foreground text-xs">(off)</span>
                        {/if}
                    </p>
                </div>
                <div class="flex shrink-0 items-center gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        class="size-7"
                        disabled={reordering || index === 0}
                        onclick={() => move(index, -1)}>
                        <ChevronUpIcon class="size-4" aria-hidden="true" />
                        <span class="sr-only">Move {scraper!.name} up</span>
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        class="size-7"
                        disabled={reordering || index === ordered.length - 1}
                        onclick={() => move(index, 1)}>
                        <ChevronDownIcon class="size-4" aria-hidden="true" />
                        <span class="sr-only">Move {scraper!.name} down</span>
                    </Button>
                </div>
            </div>
        {/each}
    </div>
</div>
