<script lang="ts">
    import type { PageData, ActionData } from "./$types";
    import { enhance } from "$app/forms";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import PageShell from "$lib/components/page-shell.svelte";
    import DownloadIcon from "@lucide/svelte/icons/download";
    import ItemManualScrape from "$lib/components/media/riven/item-manual-scrape.svelte";
    import BookmarkIcon from "@lucide/svelte/icons/bookmark";
    import CheckIcon from "@lucide/svelte/icons/check";
    import LoaderIcon from "@lucide/svelte/icons/loader-circle";
    import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
    import { describeState } from "$lib/utils/item-state";
    import { formatBytes } from "$lib/helpers";
    import { cn } from "$lib/utils";
    import PlayIcon from "@lucide/svelte/icons/play";
    import { openPlayer } from "$lib/stores/player.svelte";
    import MediaRowItem from "$lib/components/media/media-row-item.svelte";

    let { data, form }: { data: PageData; form: ActionData } = $props();

    const item = $derived(data.item as Record<string, any>);
    const collected = $derived(data.collected || (form as any)?.collected === true);

    // `libraryState` is what Riven already knows; the form result covers the
    // moment just after requesting, before the page has been reloaded.
    const libraryState = $derived(data.libraryState ?? null);
    const requested = $derived(!!libraryState || (form as any)?.requested === true);
    const status = $derived(libraryState ? describeState(libraryState.state) : null);

    const files = $derived(libraryState?.files ?? []);
    const releases = $derived(libraryState?.streams ?? []);

    // Infohash of the release currently being switched to, so only that row
    // shows a spinner while the whole list disables.
    let selecting = $state<string | null>(null);

    // Playable means a file is actually mounted, not merely that the item
    // reached Completed -- the VFS entry is what the stream endpoint reads.
    const playable = $derived(files.some((file) => file.available_in_vfs));

    const poster = $derived(item.poster || item.posters?.large || item.image || null);
    const backdrop = $derived(item.background?.full || item.background?.large || null);
    const performers = $derived((item.performers ?? []).filter((p: any) => p?.name));
    const tags = $derived((item.tags ?? []).filter((t: any) => t?.name));

    // Related rows link the same way list-item.svelte does: prefer the TPDB
    // uuid, falling back to the numeric id.
    const relatedHref = (related: Record<string, any>) =>
        `/details/tpdb/${data.type}/${related.tpdb_uuid ?? related.id}`;

    // TPDB reports duration in seconds.
    const runtime = $derived.by(() => {
        const seconds = Number(item.duration ?? 0);
        if (!seconds) return null;
        const h = Math.floor(seconds / 3600);
        const m = Math.round((seconds % 3600) / 60);
        return h ? `${h}h ${m}m` : `${m}m`;
    });
</script>

<svelte:head>
    <title>{item.title || "Title"} - Riven TPDB</title>
</svelte:head>

<PageShell class="bg-background relative flex min-h-screen flex-col overflow-x-hidden">
    {#if backdrop}
        <div class="pointer-events-none absolute inset-x-0 top-0 h-[60vh]">
            <img src={backdrop} alt="" class="h-full w-full object-cover opacity-30" />
            <div class="from-background absolute inset-0 bg-gradient-to-t via-transparent"></div>
        </div>
    {/if}

    <div
        class="relative z-10 mx-auto flex w-full max-w-[1400px] flex-col gap-10 px-6 pt-10 pb-24 md:px-12 md:pt-20">
        <div class="flex flex-col gap-8 md:flex-row">
            {#if poster}
                <img
                    src={poster}
                    alt={item.title}
                    class="w-56 shrink-0 self-start rounded-2xl shadow-2xl shadow-black/50" />
            {/if}

            <div class="flex flex-col gap-4">
                <h1 class="text-foreground text-3xl font-black tracking-tight sm:text-5xl">
                    {item.title}
                </h1>

                <div class="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
                    {#if item.site?.name}<span class="font-semibold">{item.site.name}</span>{/if}
                    {#if item.date}<span>{item.date}</span>{/if}
                    {#if runtime}<span>{runtime}</span>{/if}
                </div>

                {#if item.description}
                    <p class="text-muted-foreground max-w-3xl leading-relaxed">
                        {item.description}
                    </p>
                {/if}

                {#if performers.length}
                    <div class="flex flex-wrap gap-2">
                        {#each performers as performer (performer.id ?? performer.name)}
                            <Badge variant="secondary">{performer.name}</Badge>
                        {/each}
                    </div>
                {/if}

                {#if tags.length}
                    <div class="flex flex-wrap gap-1.5">
                        {#each tags.slice(0, 20) as tag (tag.id ?? tag.name)}
                            <Badge variant="outline" class="text-xs">{tag.name}</Badge>
                        {/each}
                    </div>
                {/if}

                <div class="mt-2 flex flex-wrap items-center gap-3">
                    {#if playable && libraryState}
                        <Button onclick={() => openPlayer(libraryState.riven_id, item.title)}>
                            <PlayIcon class="mr-2 size-4" />
                            Play
                        </Button>
                    {/if}

                    <!--
                        A title already in the library must not offer Request
                        as though nothing had happened -- show where it actually
                        stands instead, and only fall back to the form when
                        Riven has never seen it.
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
                            <input type="hidden" name="uuid" value={item.id} />
                            <input type="hidden" name="type" value={data.type} />
                            <Button type="submit" disabled={requested}>
                                <DownloadIcon class="mr-2 size-4" />
                                {requested ? "Queued in Riven" : "Request"}
                            </Button>
                        </form>
                    {/if}

                    <!--
                        Manual scrape: pick the exact release and file rather
                        than letting the ranker choose. Addressed by TPDB uuid,
                        so it works before the title exists in the library.
                    -->
                    <ItemManualScrape
                        title={item.title}
                        externalId=""
                        tpdbId={data.tpdbUuid}
                        mediaType="movie"
                        variant="outline"
                        size="default" />

                    {#if data.numericId}
                        <form method="POST" action="?/collect" use:enhance>
                            <input type="hidden" name="numericId" value={data.numericId} />
                            <Button type="submit" variant="outline" disabled={collected}>
                                <BookmarkIcon class="mr-2 size-4" />
                                {collected ? "In TPDB collection" : "Add to TPDB collection"}
                            </Button>
                        </form>
                    {/if}
                </div>

                {#if status}
                    <p class="text-muted-foreground text-xs">
                        {status.description}
                    </p>
                {/if}

                {#if files.length}
                    <div class="mt-2 flex flex-col gap-2">
                        <p
                            class="text-primary font-mono text-xs font-semibold tracking-wider uppercase">
                            On disk
                        </p>
                        {#each files as file (file.path ?? file.filename)}
                            <div class="bg-muted/40 flex flex-col gap-1.5 rounded-lg p-3">
                                <div class="flex flex-wrap items-center gap-2">
                                    {#if file.resolution}
                                        <Badge variant="secondary" class="font-mono text-xs">
                                            {file.resolution}
                                        </Badge>
                                    {/if}
                                    {#if file.codec}
                                        <Badge variant="outline" class="font-mono text-xs">
                                            {file.codec}
                                        </Badge>
                                    {/if}
                                    {#if file.hdr_type}
                                        <Badge variant="outline" class="font-mono text-xs">
                                            {file.hdr_type}
                                        </Badge>
                                    {/if}
                                    <Badge variant="outline" class="font-mono text-xs">
                                        {formatBytes(file.file_size)}
                                    </Badge>
                                    {#if !file.available_in_vfs}
                                        <Badge variant="outline" class="text-xs">Not mounted</Badge>
                                    {/if}
                                </div>
                                {#if file.path}
                                    <p class="text-muted-foreground font-mono text-xs break-all">
                                        {file.path}
                                    </p>
                                {/if}
                                <p class="text-muted-foreground/70 font-mono text-xs break-all">
                                    from {file.filename}
                                </p>
                            </div>
                        {/each}
                    </div>
                {/if}

                <!--
                    Candidate releases: every release the scrapers found for
                    this title. Shown whether or not something is downloaded,
                    because swapping to a different release is the whole point
                    of the list -- hiding it once one succeeded left no way to
                    say "not that one, this one".
                -->
                {#if releases.length}
                    <div class="mt-2 flex flex-col gap-2">
                        <div class="flex flex-wrap items-baseline justify-between gap-2">
                            <p
                                class="text-primary font-mono text-xs font-semibold tracking-wider uppercase">
                                Candidate releases
                            </p>
                            <p class="text-muted-foreground/70 text-xs">
                                {releases.length} found by the scrapers
                            </p>
                        </div>

                        <div class="divide-border/40 flex flex-col divide-y">
                            {#each releases as release (release.infohash)}
                                <div
                                    class="flex flex-col gap-2 py-2 sm:flex-row sm:items-start sm:gap-3">
                                    <div class="flex shrink-0 gap-1.5">
                                        <Badge
                                            variant={release.resolution ? "secondary" : "outline"}
                                            class="shrink-0 font-mono text-xs">
                                            {release.resolution ?? "?"}
                                        </Badge>
                                    </div>

                                    <div class="min-w-0 flex-1">
                                        <p class="text-muted-foreground text-xs break-all">
                                            {release.raw_title}
                                        </p>
                                        <div class="mt-1 flex flex-wrap items-center gap-2">
                                            {#if release.is_active}
                                                <Badge
                                                    class="border-0 bg-green-600/90 text-[10px] text-white">
                                                    Downloaded
                                                </Badge>
                                            {/if}
                                            {#if release.is_preferred && !release.is_active}
                                                <!--
                                                    "Selected", not
                                                    "downloading": picking a
                                                    release queues it with the
                                                    provider, which may sit in
                                                    a swarm for hours before a
                                                    byte is transferred. The
                                                    item badge says what is
                                                    actually happening.
                                                -->
                                                <Badge
                                                    class="border-0 bg-blue-600/90 text-[10px] text-white">
                                                    Selected
                                                </Badge>
                                            {/if}
                                            {#if release.is_blacklisted}
                                                <Badge
                                                    variant="outline"
                                                    class="text-muted-foreground/70 text-[10px]">
                                                    Rejected earlier
                                                </Badge>
                                            {/if}
                                            <!--
                                                What the indexer claimed at
                                                scrape time. A release with no
                                                seeders is the single best
                                                predictor of a download that
                                                never starts, so it is called
                                                out rather than shown as a
                                                neutral number -- and an
                                                indexer that reported nothing
                                                is left blank rather than
                                                rendered as zero.
                                            -->
                                            {#if release.seeders !== null && release.seeders !== undefined}
                                                <Badge
                                                    variant="outline"
                                                    class={cn(
                                                        "font-mono text-[10px]",
                                                        release.seeders === 0
                                                            ? "border-red-500/40 text-red-500"
                                                            : "text-muted-foreground/80"
                                                    )}>
                                                    {release.seeders} seed{release.seeders === 1
                                                        ? ""
                                                        : "s"}
                                                    {#if release.leechers !== null && release.leechers !== undefined}
                                                        / {release.leechers} leech
                                                    {/if}
                                                </Badge>
                                            {/if}
                                            {#if release.size}
                                                <Badge
                                                    variant="outline"
                                                    class="text-muted-foreground/80 font-mono text-[10px]">
                                                    {formatBytes(release.size)}
                                                </Badge>
                                            {/if}
                                            {#if release.indexer}
                                                <Badge
                                                    variant="outline"
                                                    class="text-muted-foreground/80 text-[10px]">
                                                    {release.indexer}
                                                </Badge>
                                            {/if}
                                            <span class="text-muted-foreground/60 font-mono text-[10px]">
                                                rank {release.rank}
                                            </span>
                                        </div>
                                    </div>

                                    {#if !release.is_active && libraryState?.riven_id}
                                        <form
                                            method="POST"
                                            action="?/selectRelease"
                                            use:enhance={() => {
                                                selecting = release.infohash;
                                                return async ({ update }) => {
                                                    await update();
                                                    selecting = null;
                                                };
                                            }}
                                            class="shrink-0">
                                            <input
                                                type="hidden"
                                                name="rivenId"
                                                value={libraryState.riven_id} />
                                            <input
                                                type="hidden"
                                                name="infohash"
                                                value={release.infohash} />
                                            <Button
                                                type="submit"
                                                size="sm"
                                                variant="outline"
                                                class="h-7 w-full text-xs sm:w-auto"
                                                disabled={selecting !== null}>
                                                {#if selecting === release.infohash}
                                                    <LoaderIcon class="size-3 animate-spin" />
                                                {:else if release.is_blacklisted}
                                                    <RotateCcwIcon class="size-3" />
                                                {:else}
                                                    <DownloadIcon class="size-3" />
                                                {/if}
                                                <!--
                                                    Same action either way: the
                                                    backend un-rejects before
                                                    queueing. Only the wording
                                                    changes, because "use this"
                                                    on a release marked
                                                    "rejected earlier" reads as
                                                    though it would fail.
                                                -->
                                                {release.is_blacklisted ? "Retry" : "Use this"}
                                            </Button>
                                        </form>
                                    {/if}
                                </div>
                            {/each}
                        </div>

                        <p class="text-muted-foreground/70 text-xs">
                            Seeders, size and indexer are what the indexer claimed when this title
                            was scraped, not a live reading. Releases Riven gave up on stay listed
                            so you can retry them; choosing one replaces the current download and
                            keeps the rest of this list.
                        </p>
                    </div>
                {/if}

                {#if collected}
                    <p class="text-muted-foreground text-xs">
                        TPDB has no endpoint for removing a title from a collection, so this cannot
                        be undone from here.
                    </p>
                {/if}

                {#if (form as any)?.message}
                    <p class="text-destructive text-sm">{(form as any).message}</p>
                {/if}
            </div>
        </div>

        {#await data.streamed.similar then similar}
            {#if similar.length}
                <div class="flex flex-col gap-4">
                    <h2 class="text-foreground text-2xl font-bold tracking-tight">
                        Related on TPDB
                    </h2>
                    <div class="divide-border/60 flex flex-col divide-y">
                        {#each similar as related (related.id)}
                            <MediaRowItem item={related} href={relatedHref(related)} />
                        {/each}
                    </div>
                </div>
            {/if}
        {/await}
    </div>
</PageShell>
