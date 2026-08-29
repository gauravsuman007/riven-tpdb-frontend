<script lang="ts">
    /**
     * A library title with no external record behind it.
     *
     * Deliberately plainer than the TPDB page: everything here comes from the
     * item itself, because that is all there is. The point is that a title
     * TPDB has no confident match for stays reachable and playable with the
     * metadata it already has, rather than being dropped from the library or
     * shown another film's details.
     */
    import type { PageData, ActionData } from "./$types";
    import { enhance } from "$app/forms";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import PageShell from "$lib/components/page-shell.svelte";
    import PlayIcon from "@lucide/svelte/icons/play";
    import DirectSearch from "$lib/components/media/riven/direct-search.svelte";
    import TpdbLink from "$lib/components/media/riven/tpdb-link.svelte";
    import { describeState } from "$lib/utils/item-state";
    import { openPlayer } from "$lib/stores/player.svelte";
    import { formatBytes } from "$lib/helpers";

    let { data, form }: { data: PageData; form: ActionData } = $props();

    const item = $derived(data.item as Record<string, any>);
    const status = $derived(item.state ? describeState(item.state) : null);
    const performers = $derived((item.performers ?? []).filter((p: any) => p));
    const entry = $derived(item.filesystem_entry ?? null);
    const playable = $derived(!!entry);

    const runtime = $derived.by(() => {
        const seconds = Number(item.media_metadata?.duration ?? 0);
        if (!seconds) return null;
        const h = Math.floor(seconds / 3600);
        const m = Math.round((seconds % 3600) / 60);
        return h ? `${h}h ${m}m` : `${m}m`;
    });

    const year = $derived(item.aired_at ? new Date(item.aired_at).getFullYear() : null);
</script>

<svelte:head>
    <title>{item.title || "Title"} - Riven TPDB</title>
</svelte:head>

<PageShell class="bg-background relative flex min-h-screen flex-col overflow-x-hidden">
    <div class="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div class="flex flex-col gap-6 sm:flex-row">
            {#if item.poster_path}
                <img
                    src={item.poster_path}
                    alt=""
                    referrerpolicy="no-referrer"
                    class="border-border/60 w-40 shrink-0 self-start rounded-xl border object-cover" />
            {/if}

            <div class="flex min-w-0 flex-1 flex-col gap-3">
                <h1 class="text-2xl font-semibold sm:text-3xl">{item.title}</h1>

                <div class="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                    {#if item.site_name}<span>{item.site_name}</span>{/if}
                    {#if year}<span>&middot;</span><span>{year}</span>{/if}
                    {#if runtime}<span>&middot;</span><span>{runtime}</span>{/if}
                </div>

                <div class="flex flex-wrap items-center gap-2">
                    {#if status}
                        <Badge
                            variant={status.available
                                ? "default"
                                : status.inProgress
                                  ? "secondary"
                                  : "outline"}>
                            {status.label}
                        </Badge>
                    {/if}
                    {#if entry?.file_size}
                        <Badge variant="outline" class="font-mono text-xs">
                            {formatBytes(entry.file_size)}
                        </Badge>
                    {/if}
                </div>

                {#if playable}
                    <Button class="w-fit" onclick={() => openPlayer(item.id, item.title)}>
                        <PlayIcon class="mr-2 size-4" />
                        Play
                    </Button>
                {/if}

                <!--
                    The whole reason this page exists. An item lands here
                    because nothing on TPDB was confidently its match -- so
                    the one control it most needs is the ability to say what
                    the right record is, or to confirm there is none.
                -->
                <TpdbLink itemId={item.id} title={item.title} currentTpdbId={item.tpdb_id ?? null} {form} />
            </div>
        </div>

        {#if performers.length}
            <div class="mt-8 flex flex-col gap-2">
                <h2 class="text-sm font-semibold">Cast</h2>
                <div class="flex flex-wrap gap-1.5">
                    {#each performers as name (name)}
                        <Badge variant="secondary" class="text-xs">{name}</Badge>
                    {/each}
                </div>
            </div>
        {/if}

        <div class="mt-8">
            <DirectSearch title={item.title} itemId={item.id} />
        </div>
    </div>
</PageShell>
