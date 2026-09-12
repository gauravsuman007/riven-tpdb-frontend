<!--
    Live control for the OnlyFans scraper registry, alongside the
    (partly-hidden -- see settings/visibility.py) generic form for this section.

    A separate folder and a separate registry from the direct-scrape plugins on
    the Plugins tab, and deliberately so: those answer "find me this title",
    these answer "who does this site carry". Merging them would put an OnlyFans
    scraper in the direct-play site list and a tube scraper in this tab
    claiming to index performers.

    "Which scrapers are enabled" is a toggle against a live registry rather
    than a value to save -- the folder can gain a file at any time from outside
    this page -- so this polls for a fresh list instead of trusting whatever
    was true when the tab was opened.
-->
<script lang="ts">
    import { onDestroy } from "svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
    import CircleAlertIcon from "@lucide/svelte/icons/circle-alert";
    import UsersIcon from "@lucide/svelte/icons/users";
    import UploadIcon from "@lucide/svelte/icons/upload";
    import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
    import {
        getPlugins,
        rescanPlugins,
        setPluginEnabled,
        importPlugins,
        syncAccounts,
        type OnlyFansPlugins,
        type ImportResult
    } from "$lib/onlyfans";

    let status = $state<OnlyFansPlugins | null>(null);
    let busyKey = $state<string | null>(null);
    let rescanning = $state(false);
    let importing = $state(false);
    let syncing = $state(false);
    let failure = $state<string | null>(null);
    let notice = $state<string | null>(null);
    let imported = $state<ImportResult[]>([]);
    let fileInput = $state<HTMLInputElement | null>(null);

    async function refresh() {
        const next = await getPlugins();
        if (next) {
            status = next;
            failure = null;
        } else {
            failure = "Could not read the OnlyFans scraper registry";
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

    async function upload(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        if (!input.files?.length) return;

        importing = true;
        imported = [];
        const result = await importPlugins(input.files);

        if (result) {
            status = result.plugins;
            imported = result.results;
            failure = null;
        } else {
            failure = "Import failed";
        }

        // Cleared so re-picking the same file fires a change event again --
        // otherwise a second attempt after a rejection appears to do nothing.
        input.value = "";
        importing = false;
    }

    async function sync() {
        syncing = true;
        notice = null;
        const result = await syncAccounts();

        if (result) {
            notice = `Indexed ${result.accounts} account${result.accounts === 1 ? "" : "s"}.`;
            failure = null;
        } else {
            failure = "Sync failed. Is the OnlyFans index enabled above?";
        }
        syncing = false;
    }

    // A file copied onto the server has no event to announce itself, so this
    // notices one the same way the Plugins tab does: by asking again. Cheap --
    // a handful of files on local disk.
    const poller = setInterval(refresh, 5000);
    onDestroy(() => clearInterval(poller));

    refresh();

    const scrapers = $derived(status?.scrapers ?? []);
    const broken = $derived(Object.entries(status?.errors ?? {}));
</script>

<div class="border-border/60 bg-muted/30 flex flex-col gap-4 rounded-lg border p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
            <UsersIcon class="text-muted-foreground size-4" aria-hidden="true" />
            <div class="min-w-0">
                <p class="text-sm font-medium">OnlyFans scrapers</p>
                <p class="text-muted-foreground text-xs">
                    Performer-index scrapers in
                    <code class="bg-background rounded px-1 py-0.5 font-mono text-[11px]">
                        {status?.plugin_dir ?? "…"}
                    </code>
                    — a separate folder from the direct-scrape plugins, mapped from a host folder in docker-compose.yml.
                </p>
            </div>
        </div>
        <div class="flex items-center gap-2">
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={importing}
                onclick={() => fileInput?.click()}>
                <UploadIcon class="mr-2 size-4" aria-hidden="true" />
                Import
            </Button>
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={rescanning}
                onclick={rescan}>
                <RotateCcwIcon
                    class="mr-2 size-4 {rescanning ? 'animate-spin' : ''}"
                    aria-hidden="true" />
                Rescan folder
            </Button>
        </div>
    </div>

    <!-- Hidden and driven by the button above: the native file input cannot be
	     styled to match, and a bare one reads as a debug control. -->
    <input
        bind:this={fileInput}
        type="file"
        accept=".py"
        multiple
        class="hidden"
        onchange={upload} />

    {#if failure}
        <p class="text-destructive text-xs">{failure}</p>
    {/if}

    {#if notice}
        <p class="text-xs text-emerald-400">{notice}</p>
    {/if}

    {#if imported.length}
        <div class="flex flex-col gap-1">
            {#each imported as result (result.filename)}
                <p class="text-xs {result.accepted ? 'text-emerald-400' : 'text-destructive'}">
                    {result.filename}:
                    {#if result.accepted}
                        imported as <span class="font-mono">{result.key}</span>
                    {:else}
                        {result.error}
                    {/if}
                </p>
            {/each}
            <p class="text-muted-foreground text-[11px]">
                A rejected file is never written to the folder, so there is nothing to clean up.
            </p>
        </div>
    {/if}

    <div class="flex flex-col gap-2">
        <span class="text-muted-foreground text-xs font-medium">
            Installed ({scrapers.filter((s) => s.enabled).length} of {scrapers.length} enabled)
        </span>

        {#if scrapers.length === 0 && broken.length === 0}
            <p class="text-muted-foreground text-xs">
                No scrapers found. Import a .py file above, or copy one into the folder and click
                "Rescan folder".
            </p>
        {/if}

        {#each scrapers as scraper (scraper.key)}
            <div
                class="border-border/60 bg-background/60 flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div class="min-w-0">
                    <p class="truncate text-sm font-medium">
                        {scraper.name}
                        {#if !scraper.indexes_accounts}
                            <!-- Worth saying out loud: such a file loads fine and then
							     contributes nothing to the index, which otherwise reads
							     as a broken sync rather than a scraper doing its job. -->
                            <span class="text-muted-foreground ml-1 text-[11px] font-normal">
                                does not index performers
                            </span>
                        {/if}
                    </p>
                    <p class="text-muted-foreground truncate font-mono text-xs">
                        {scraper.base_url}
                    </p>
                </div>
                <Switch
                    checked={scraper.enabled}
                    disabled={busyKey === scraper.key}
                    onCheckedChange={(v: boolean) => toggle(scraper.key, v)} />
            </div>
        {/each}

        {#each broken as [filename, error] (filename)}
            <div
                class="border-destructive/40 bg-destructive/10 flex items-start gap-2 rounded-lg border px-3 py-2">
                <CircleAlertIcon
                    class="text-destructive mt-0.5 size-4 shrink-0"
                    aria-hidden="true" />
                <div class="min-w-0">
                    <p class="truncate font-mono text-xs font-medium">{filename}</p>
                    <p class="text-muted-foreground text-xs">{error}</p>
                </div>
            </div>
        {/each}
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
        <div class="min-w-0">
            <p class="text-sm font-medium">Rebuild the account index</p>
            <p class="text-muted-foreground text-xs">
                Normally weekly, on the schedule above. This runs it now — a full crawl of every
                enabled site, so it takes a while.
            </p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={syncing} onclick={sync}>
            <RefreshCwIcon class="mr-2 size-4 {syncing ? 'animate-spin' : ''}" aria-hidden="true" />
            Sync now
        </Button>
    </div>
</div>
