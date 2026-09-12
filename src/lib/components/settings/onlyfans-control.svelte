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
    import SparklesIcon from "@lucide/svelte/icons/sparkles";
    import {
        getPlugins,
        rescanPlugins,
        setPluginEnabled,
        importPlugins,
        startSync,
        startEnrich,
        syncStatus,
        type OnlyFansPlugins,
        type OnlyFansSyncStatus,
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
    let runs = $state<OnlyFansSyncStatus | null>(null);
    let startingSite = $state<string | null>(null);
    let enriching = $state(false);

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

    async function refreshRuns() {
        const next = await syncStatus();
        if (next) runs = next;
    }

    /**
     * Start a walk, for one site or (with no argument) for every configured
     * one.
     *
     * The button does not wait for the result. A full walk is several hundred
     * requests and minutes of work, so the endpoint starts it and answers with
     * the status; progress arrives through the poller below, which is the only
     * thing that can report it while it happens.
     */
    async function sync(site?: string) {
        startingSite = site ?? "*";
        syncing = true;
        notice = null;

        const result = await startSync(site ? [site] : undefined);

        if ("error" in result) {
            failure = result.error;
        } else {
            runs = result.status;
            failure = null;
            notice = site
                ? `Indexing ${site}…`
                : "Indexing every enabled site — this takes a few minutes.";
        }

        startingSite = null;
        syncing = false;
    }

    /*
        The other half of the job, and the one that fills the pictures. It is
        separate from the sync on purpose: the sync finds out WHO exists and
        is wide and fast, while this asks onlyfans.com about one account at a
        time and is paced, so running it takes minutes and says nothing until
        the totals above move.
    */
    async function enrich() {
        enriching = true;
        notice = null;

        const result = await startEnrich();

        if ("error" in result) {
            failure = result.error;
        } else {
            runs = result.status;
            failure = null;
            notice = "Fetching profiles — the counts above fill in as it runs.";
        }

        enriching = false;
    }

    // A file copied onto the server has no event to announce itself, so this
    // notices one the same way the Plugins tab does: by asking again. Cheap --
    // a handful of files on local disk. The run status rides the same timer
    // because it is the progress readout for a walk that can last minutes.
    const poller = setInterval(() => {
        refresh();
        refreshRuns();
    }, 5000);
    onDestroy(() => clearInterval(poller));

    refresh();
    refreshRuns();

    /** "4 minutes ago", or null when there is no timestamp to describe. */
    function ago(value: string | null): string | null {
        if (!value) return null;

        const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);

        if (seconds < 60) return "just now";
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }

    const STATE_STYLE: Record<string, string> = {
        running: "text-sky-400",
        ok: "text-emerald-400",
        failed: "text-destructive",
        never: "text-muted-foreground"
    };

    const anyRunning = $derived(runs?.sites.some((run) => run.state === "running") ?? false);

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

    <div class="flex flex-col gap-3 border-t border-white/10 pt-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
                <p class="text-sm font-medium">Account index</p>
                <p class="text-muted-foreground text-xs">
                    {#if runs}
                        {runs.accounts.toLocaleString()} accounts, {runs.accounts_with_avatar.toLocaleString()}
                        with a picture, {runs.accounts_with_profile.toLocaleString()} matched to an
                        onlyfans.com profile. Rebuilt weekly on the schedule above.
                    {:else}
                        Rebuilt weekly on the schedule above.
                    {/if}
                </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={enriching}
                    onclick={enrich}>
                    <SparklesIcon
                        class="mr-2 size-4 {enriching ? 'animate-pulse' : ''}"
                        aria-hidden="true" />
                    Fetch profiles
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={syncing || anyRunning}
                    onclick={() => sync()}>
                    <RefreshCwIcon
                        class="mr-2 size-4 {syncing || anyRunning ? 'animate-spin' : ''}"
                        aria-hidden="true" />
                    Sync every site
                </Button>
            </div>
        </div>

        <!--
            One row per configured site, not per installed scraper: a site
            named in the settings but with no scraper in the folder is the
            case worth showing, and it would simply be absent from a list
            built the other way round.
        -->
        {#each runs?.sites ?? [] as run (run.site)}
            <div
                class="border-border/60 bg-background/60 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div class="min-w-0 flex-1">
                    <p class="flex items-center gap-2 text-sm font-medium">
                        <span class="truncate">{run.site}</span>
                        <span class="text-[11px] font-normal {STATE_STYLE[run.state] ?? ''}">
                            {#if run.state === "running"}
                                indexing…
                            {:else if run.state === "never"}
                                not indexed yet
                            {:else if run.state === "failed"}
                                failed
                            {:else}
                                done {ago(run.finished_at) ?? ""}
                            {/if}
                        </span>
                    </p>

                    <p class="text-muted-foreground text-xs">
                        {#if !run.available}
                            <!--
                                A configured site with no scraper behind it
                                would otherwise sit at "not indexed yet"
                                looking like it was merely waiting its turn.
                            -->
                            No scraper installed for this site — import one above.
                        {:else if run.state === "never"}
                            Never walked. Press Index to build it now.
                        {:else}
                            <!--
                                A count of pages, never a percentage: these
                                indexes publish no length and end by 404ing
                                the page after the last one, so there is
                                nothing honest to divide by.
                            -->
                            {run.pages.toLocaleString()} page{run.pages === 1 ? "" : "s"},
                            {run.accounts_seen.toLocaleString()} account{run.accounts_seen === 1
                                ? ""
                                : "s"}
                            {#if run.state !== "running"}
                                · {run.accounts_new.toLocaleString()} new
                            {/if}
                            {#if run.state === "running" && run.started_at}
                                · started {ago(run.started_at)}
                            {/if}
                        {/if}
                    </p>

                    {#if run.error}
                        <p class="text-destructive mt-0.5 truncate text-xs" title={run.error}>
                            {run.error}
                        </p>
                    {/if}
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!run.available || run.state === "running" || startingSite !== null}
                    onclick={() => sync(run.site)}>
                    <RefreshCwIcon
                        class="mr-2 size-4 {run.state === 'running' ? 'animate-spin' : ''}"
                        aria-hidden="true" />
                    Index
                </Button>
            </div>
        {/each}
    </div>
</div>
