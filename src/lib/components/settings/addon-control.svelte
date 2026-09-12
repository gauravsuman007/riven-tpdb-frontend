<script lang="ts">
    /*
        Add-ons: what is installed, what state each one is in, and the
        operations that change that.

        Everything here is live action against the backend rather than settings
        to save, which is why it sits alongside the generated form instead of
        inside it -- the same reason the VPN and Plugins panels do.

        Two destructive operations, deliberately kept apart. "Remove" deletes
        the folder and leaves the add-on's database schema standing, so
        reinstalling finds its data where it left it. "Remove and delete data"
        additionally drops that schema, which is one statement and cannot be
        undone -- so it names what it is about to destroy and asks again.
    */
    import { onMount } from "svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import PuzzleIcon from "@lucide/svelte/icons/puzzle";
    import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
    import DownloadIcon from "@lucide/svelte/icons/download";
    import TrashIcon from "@lucide/svelte/icons/trash-2";
    import CircleAlertIcon from "@lucide/svelte/icons/circle-alert";
    import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
    import {
        listAddons,
        rescanAddons,
        installAddon,
        updateAddon,
        setAddonEnabled,
        removeAddon,
        formatBytes,
        type Addon,
        type AddonsResponse
    } from "$lib/addons";

    let data = $state<AddonsResponse | null>(null);
    let failure = $state<string | null>(null);
    let notice = $state<string | null>(null);
    let busy = $state<string | null>(null);
    let url = $state("");
    let ref = $state("");
    /*
        Only for a private repository, and only for this one install: it is
        sent, used as a per-command git header and forgotten. The persistent
        answer is the `addons_git_token` setting, which this falls back to.
    */
    let token = $state("");
    let installing = $state(false);

    /*
        Which add-on is being removed, and whether its data goes too. Held as
        state rather than a `confirm()` because the answer depends on numbers
        the user needs to see -- "and its 6,402 rows" is a different decision
        from "remove this add-on", and a browser dialog cannot show them.
    */
    let removing = $state<{ addon: Addon; purge: boolean } | null>(null);

    const STATE_STYLE: Record<string, string> = {
        ok: "text-emerald-400",
        disabled: "text-muted-foreground",
        failed: "text-red-400"
    };

    function apply(result: { addons: AddonsResponse } | { error: string }) {
        if ("error" in result) {
            failure = result.error;
            return false;
        }

        data = result.addons;
        failure = null;
        return true;
    }

    async function refresh() {
        const result = await listAddons();
        if ("addons" in result) data = result.addons;
    }

    onMount(refresh);

    async function rescan() {
        busy = "*";
        notice = null;
        if (apply(await rescanAddons())) notice = "Re-read the add-ons folder.";
        busy = null;
    }

    async function install() {
        if (!url.trim()) return;

        installing = true;
        notice = null;

        if (apply(await installAddon(url, ref, token))) {
            notice = "Installed. Its page and settings are available now.";
            url = "";
            ref = "";
            token = "";
        }

        installing = false;
    }

    async function update(addon: Addon) {
        busy = addon.key;
        notice = null;
        if (apply(await updateAddon(addon.key))) notice = `${addon.name} updated.`;
        busy = null;
    }

    async function toggle(addon: Addon, enabled: boolean) {
        busy = addon.key;
        notice = null;
        apply(await setAddonEnabled(addon.key, enabled));
        busy = null;
    }

    async function confirmRemove() {
        if (!removing) return;

        const { addon, purge } = removing;
        busy = addon.key;
        removing = null;
        notice = null;

        if (apply(await removeAddon(addon.key, purge))) {
            notice = purge
                ? `${addon.name} and all of its data have been removed.`
                : `${addon.name} removed. Its data is still there if you reinstall it.`;
        }

        busy = null;
    }
</script>

<div class="border-border/60 bg-muted/30 flex flex-col gap-4 rounded-lg border p-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
            <p class="flex items-center gap-2 text-sm font-medium">
                <PuzzleIcon class="size-4" aria-hidden="true" />
                Add-ons
            </p>
            <p class="text-muted-foreground text-xs">
                Self-contained features with their own pages, settings and database schema.
                {#if data}
                    Loaded from <code class="font-mono">{data.directory}</code>.
                {/if}
            </p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={busy !== null} onclick={rescan}>
            <RefreshCwIcon
                class="mr-2 size-4 {busy === '*' ? 'animate-spin' : ''}"
                aria-hidden="true" />
            Rescan
        </Button>
    </div>

    <!-- Install from a git URL -->
    <div class="border-border/60 flex flex-col gap-2 rounded-md border border-dashed p-3">
        <label class="text-xs font-medium" for="addon-url">Install from a git repository</label>
        <div class="flex flex-wrap gap-2">
            <input
                id="addon-url"
                bind:value={url}
                placeholder="https://github.com/you/riven-addon-something"
                class="border-border/60 bg-background min-w-0 flex-1 rounded-md border px-3 py-1.5 font-mono text-xs" />
            <input
                bind:value={ref}
                placeholder="branch or tag (optional)"
                class="border-border/60 bg-background w-40 rounded-md border px-3 py-1.5 font-mono text-xs" />
            <input
                bind:value={token}
                type="password"
                placeholder="token (private repos)"
                class="border-border/60 bg-background w-44 rounded-md border px-3 py-1.5 font-mono text-xs" />
            <Button
                type="button"
                size="sm"
                disabled={installing || !url.trim()}
                onclick={install}>
                <DownloadIcon
                    class="mr-2 size-4 {installing ? 'animate-pulse' : ''}"
                    aria-hidden="true" />
                Install
            </Button>
        </div>
        <!--
            Said plainly rather than buried in documentation. An add-on runs in
            the backend process with its database and its credentials, so this
            field is a way to run someone else's code as Riven. There is no
            sandbox, and pretending otherwise would be worse than saying so.
        -->
        <p class="text-muted-foreground text-[11px]">
            An add-on runs inside Riven with full access to its database and credentials. There is
            no sandbox — only install add-ons you would trust with a shell.
        </p>
    </div>

    {#if failure}
        <p class="flex items-start gap-2 text-xs text-red-400">
            <CircleAlertIcon class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {failure}
        </p>
    {/if}

    {#if notice}
        <p class="text-muted-foreground text-xs">{notice}</p>
    {/if}

    <!-- Installed add-ons -->
    <div class="flex flex-col gap-2">
        {#if data && data.addons.length === 0}
            <p class="text-muted-foreground text-xs">
                Nothing installed yet. Paste a repository URL above.
            </p>
        {/if}

        {#each data?.addons ?? [] as addon (addon.key)}
            <div class="border-border/60 bg-background/40 flex flex-col gap-2 rounded-md border p-3">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0">
                        <p class="flex flex-wrap items-center gap-2 text-sm font-medium">
                            {addon.name}
                            <span class="text-muted-foreground font-mono text-[11px]">
                                {addon.version}
                            </span>
                            <span class="font-mono text-[11px] {STATE_STYLE[addon.state] ?? ''}">
                                {addon.state}
                            </span>
                        </p>
                        {#if addon.description}
                            <p class="text-muted-foreground mt-0.5 text-xs">{addon.description}</p>
                        {/if}
                    </div>

                    <div class="flex shrink-0 items-center gap-2">
                        <!-- Disabling is free and reversible: the folder, the
                             schema and the settings all stay. -->
                        <Switch
                            checked={addon.state !== "disabled"}
                            disabled={busy !== null}
                            onCheckedChange={(value) => toggle(addon, value)}
                            aria-label="Enable {addon.name}" />
                        {#if addon.source}
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={busy !== null}
                                onclick={() => update(addon)}>
                                <ArrowUpIcon class="size-4" aria-hidden="true" />
                            </Button>
                        {/if}
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busy !== null}
                            onclick={() => (removing = { addon, purge: false })}>
                            <TrashIcon class="size-4 text-red-400" aria-hidden="true" />
                        </Button>
                    </div>
                </div>

                {#if addon.error}
                    <p class="flex items-start gap-2 font-mono text-[11px] text-red-400">
                        <CircleAlertIcon class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        {addon.error}
                    </p>
                {/if}

                <!-- Whatever the add-on chose to report about itself, plus
                     what a purge would cost. -->
                <div class="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                    {#each Object.entries(addon.status) as [label, value] (label)}
                        <span>
                            <span class="text-foreground/80 font-mono">
                                {typeof value === "number" ? value.toLocaleString() : value}
                            </span>
                            {label.replace(/_/g, " ")}
                        </span>
                    {/each}
                    {#if addon.tables > 0}
                        <span>
                            <span class="text-foreground/80 font-mono">{addon.tables}</span>
                            {addon.tables === 1 ? "table" : "tables"},
                            <span class="text-foreground/80 font-mono">
                                {formatBytes(addon.bytes)}
                            </span>
                        </span>
                    {/if}
                    {#if addon.revision}
                        <span class="font-mono">{addon.revision}</span>
                    {/if}
                </div>
            </div>
        {/each}
    </div>
</div>

<!-- Removal, with the data decision made explicit -->
{#if removing}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div class="border-border bg-background w-full max-w-md rounded-lg border p-5">
            <h2 class="text-sm font-medium">Remove {removing.addon.name}?</h2>
            <p class="text-muted-foreground mt-2 text-xs">
                Its folder is deleted and its page and API disappear.
            </p>

            <label class="mt-4 flex items-start gap-2 text-xs">
                <input type="checkbox" bind:checked={removing.purge} class="mt-0.5" />
                <span>
                    Also delete its data —
                    <span class="font-mono">
                        {removing.addon.tables}
                        {removing.addon.tables === 1 ? "table" : "tables"},
                        {formatBytes(removing.addon.bytes)}
                    </span>
                    {#if Object.keys(removing.addon.status).length}
                        <span class="text-muted-foreground">
                            ({Object.entries(removing.addon.status)
                                .map(
                                    ([label, value]) =>
                                        `${typeof value === "number" ? value.toLocaleString() : value} ${label.replace(/_/g, " ")}`
                                )
                                .join(", ")})
                        </span>
                    {/if}
                    <span class="mt-1 block text-red-400">This cannot be undone.</span>
                </span>
            </label>

            <div class="mt-5 flex justify-end gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onclick={() => (removing = null)}>Cancel</Button>
                <Button
                    type="button"
                    variant={removing.purge ? "destructive" : "default"}
                    size="sm"
                    onclick={confirmRemove}>
                    {removing.purge ? "Remove and delete data" : "Remove"}
                </Button>
            </div>
        </div>
    </div>
{/if}
