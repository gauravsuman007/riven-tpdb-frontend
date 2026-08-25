<!--
    A brochure title, presented like any other library detail page.

    The controls are deliberately identical to the TPDB page -- Play, Request,
    candidate releases, direct site search -- because from the user's side there
    is no difference worth exposing. The only difference is underneath: this
    title has no TPDB record, and does not need one. Adult Empire supplied the
    studio, year and cast, which is everything the scrapers match on.
-->
<script lang="ts">
    import type { PageProps } from "./$types";
    import { enhance } from "$app/forms";
    import { goto, invalidateAll } from "$app/navigation";
    import { entryHref } from "$lib/collections";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import PageShell from "$lib/components/page-shell.svelte";
    import ItemManualScrape from "$lib/components/media/riven/item-manual-scrape.svelte";
    import DirectSearch from "$lib/components/media/riven/direct-search.svelte";
    import AddToCollection from "$lib/components/media/riven/add-to-collection.svelte";
    import { describeState } from "$lib/utils/item-state";
    import { liveState } from "$lib/utils/live-state.svelte";
    import { openPlayer } from "$lib/stores/player.svelte";
    import { formatBytes } from "$lib/helpers";
    import DownloadIcon from "@lucide/svelte/icons/download";
    import PlayIcon from "@lucide/svelte/icons/play";
    import CheckIcon from "@lucide/svelte/icons/check";
    import LoaderIcon from "@lucide/svelte/icons/loader-circle";
    import StarIcon from "@lucide/svelte/icons/star";
    import ClockIcon from "@lucide/svelte/icons/clock";

    let { data, form }: PageProps = $props();

    const entry = $derived(data.entry);

    // `libraryState` is what Riven already knows; the form result covers the
    // moment just after requesting, before the page has reloaded.
    const libraryState = $derived(data.libraryState ?? null);
    const requested = $derived(
        !!libraryState || entry.requested || (form as any)?.requested === true
    );
    const status = $derived(libraryState ? describeState(libraryState.state) : null);

    const files = $derived(libraryState?.files ?? []);

    // Keep the button in step with the pipeline: a request that has just been
    // made has no library row yet, and one that is downloading changes state
    // every few seconds. Without this the button reads whatever was true at
    // first paint until the page is reloaded.
    liveState(
        () => status,
        () => requested && !libraryState
    );

    // Playable means a file is actually mounted, not merely that the item
    // reached Completed -- the VFS entry is what the stream endpoint reads.
    const playable = $derived(files.some((file: any) => file.available_in_vfs));

    /*
        Scraping a brochure title resolves it against TPDB as a side effect, so
        by the time the dialog closes this page may have been superseded by a
        real library page. Re-read first -- the id is written to the entry
        server-side, so nothing here knows about it yet.
    */
    async function leaveIfResolved() {
        await invalidateAll();

        const resolved = data.entry;

        if (resolved?.tpdb_id) {
            // eslint-disable-next-line svelte/no-navigation-without-resolve -- entryHref resolves the typed route itself
            await goto(entryHref(resolved));
        }
    }

    const runtime = $derived(
        entry.duration_minutes
            ? `${Math.floor(entry.duration_minutes / 60)}h ${entry.duration_minutes % 60}m`
            : null
    );
</script>

<svelte:head>
    <title>{entry.title} · Riven</title>
</svelte:head>

<PageShell class="bg-background relative flex min-h-screen flex-col overflow-x-hidden">
    <div class="pointer-events-none fixed inset-0 z-0">
        <div class="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black"></div>
    </div>

    <div class="relative z-10 mx-auto flex w-full max-w-[1400px] flex-col gap-8 pt-32 md:pt-0">
        <div class="flex flex-col gap-8 md:flex-row">
            {#if entry.poster_path}
                <img
                    src={entry.poster_path}
                    alt={entry.title}
                    class="w-full max-w-[260px] self-start rounded-2xl border border-white/15 object-cover shadow-2xl" />
            {/if}

            <div class="flex min-w-0 flex-1 flex-col gap-4">
                <div class="space-y-2">
                    <h1
                        class="font-serif text-4xl font-medium tracking-tight text-white/90 md:text-6xl">
                        {entry.title}
                    </h1>

                    <div class="flex flex-wrap items-center gap-3 font-mono text-sm text-zinc-300">
                        {#if entry.rank}
                            <span class="text-primary">#{entry.rank}</span>
                        {/if}
                        {#if entry.rating}
                            <span class="flex items-center gap-1">
                                <StarIcon
                                    class="size-3.5 fill-amber-400 text-amber-400"
                                    aria-hidden="true" />
                                {entry.rating.toFixed(2)}/5
                            </span>
                        {/if}
                        {#if entry.year}<span>{entry.year}</span>{/if}
                        {#if runtime}
                            <span class="flex items-center gap-1">
                                <ClockIcon class="size-3.5" aria-hidden="true" />
                                {runtime}
                            </span>
                        {/if}
                        {#if entry.studio}<span>{entry.studio}</span>{/if}
                    </div>
                </div>

                {#if entry.performers?.length}
                    <div class="flex flex-wrap gap-1.5">
                        {#each entry.performers.slice(0, 20) as performer (performer)}
                            <Badge variant="secondary">{performer}</Badge>
                        {/each}
                    </div>
                {/if}

                <div class="mt-2 flex flex-wrap items-center gap-3">
                    {#if playable && libraryState}
                        <Button onclick={() => openPlayer(libraryState.riven_id, entry.title)}>
                            <PlayIcon class="mr-2 size-4" />
                            Play
                        </Button>
                    {/if}

                    <!--
                        A title already in the library must not offer Request as
                        though nothing had happened -- show where it actually
                        stands, and only fall back to the form when Riven has
                        never seen it.
                    -->
                    {#if status}
                        <Button variant="outline" disabled>
                            {#if status.available}
                                <CheckIcon class="mr-2 size-4" />
                            {:else if status.inProgress}
                                <LoaderIcon class="mr-2 size-4 animate-spin" />
                            {:else}
                                <DownloadIcon class="mr-2 size-4" />
                            {/if}
                            {status.label}
                        </Button>
                    {:else}
                        <form method="POST" action="?/request" use:enhance>
                            <input type="hidden" name="entryId" value={entry.id} />
                            <Button type="submit" disabled={requested || !entry.actionable}>
                                <DownloadIcon class="mr-2 size-4" />
                                {requested ? "Queued in Riven" : "Request"}
                            </Button>
                        </form>
                    {/if}

                    <!--
                        Candidate releases, addressed by the Adult Empire id.
                        Works before the title has been requested: the backend
                        builds a transient item from the cached brochure entry,
                        so there is nothing to look up first.
                    -->
                    <ItemManualScrape
                        title={entry.title}
                        externalId=""
                        adultempireId={entry.external_id}
                        itemId={libraryState?.riven_id ?? null}
                        mediaType="movie"
                        variant="outline"
                        size="default"
                        onClosed={leaveIfResolved} />

                    <!-- Direct site search matches on the title alone. -->
                    <DirectSearch title={entry.title} itemId={libraryState?.riven_id ?? null} />

                    <!--
                        Adding this title to a collection makes the backend look
                        it up on TPDB, so it lands in the collection with the
                        same artwork and ids a TPDB title arrives with. If TPDB
                        has no record it is added on Adult Empire's metadata
                        alone, which is enough to scrape and play it.
                    -->
                    <AddToCollection entryId={entry.id} />
                </div>

                {#if status}
                    <p class="text-xs text-zinc-400">{status.description}</p>
                {:else if !entry.actionable}
                    <p class="text-xs text-zinc-400">
                        This title has no source id cached yet; re-sync the brochure.
                    </p>
                {/if}

                {#if form?.message}
                    <p class="text-xs text-zinc-300">{form.message}</p>
                {/if}

                {#if files.length}
                    <div class="mt-2 flex flex-col gap-2">
                        <p
                            class="text-primary font-mono text-xs font-semibold tracking-wider uppercase">
                            On disk
                        </p>
                        {#each files as file (file.path ?? file.filename)}
                            <div
                                class="flex flex-wrap items-center gap-2 rounded-lg bg-white/5 p-3">
                                {#if file.resolution}
                                    <Badge variant="secondary" class="font-mono text-xs">
                                        {file.resolution}
                                    </Badge>
                                {/if}
                                <span class="truncate font-mono text-xs text-zinc-300">
                                    {file.filename ?? file.path}
                                </span>
                                {#if file.file_size}
                                    <span class="ml-auto font-mono text-xs text-zinc-400">
                                        {formatBytes(file.file_size)}
                                    </span>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    </div>
</PageShell>
