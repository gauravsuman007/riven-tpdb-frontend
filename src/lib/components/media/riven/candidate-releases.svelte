<script lang="ts">
    /**
     * Candidate releases for a library item.
     *
     * Extracted from the TPDB detail page so the riven-id fallback page can
     * show the same thing. It previously could not: that page was written
     * "deliberately plainer", which in practice meant a downloaded title with
     * no TPDB match lost both the release list and the manual-scrape button --
     * the two controls that matter most on exactly those titles, since they
     * are the ones the automatic matcher could not resolve.
     *
     * One component rather than two copies so the pages cannot drift again.
     */
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Collapsible from "$lib/components/ui/collapsible/index.js";
    import ReleaseMeta from "$lib/components/media/riven/release-meta.svelte";
    import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
    import DownloadIcon from "@lucide/svelte/icons/download";
    import LayersIcon from "@lucide/svelte/icons/layers";
    import LoaderIcon from "@lucide/svelte/icons/loader-circle";
    import CheckIcon from "@lucide/svelte/icons/check";
    import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
    import { enhance } from "$app/forms";
    import { cn } from "$lib/utils";

    interface Release {
        infohash: string;
        raw_title: string;
        resolution: string | null;
        seeders: number | null;
        leechers: number | null;
        size: number | null;
        indexer: string | null;
        rank: number | null;
        is_active: boolean;
        is_downloaded: boolean;
        is_downloading: boolean;
        is_preferred: boolean;
        is_blacklisted: boolean;
    }

    interface Props {
        releases: Release[];
        /** Riven item id, submitted with the select-release form. */
        rivenId: number | null | undefined;
    }

    let { releases, rivenId }: Props = $props();

    // Collapsed by default: the list is long, technical, and irrelevant until
    // something has gone wrong.
    let releasesOpen = $state(false);

    // Infohash of the release being switched to, so only that row spins.
    let selecting = $state<string | null>(null);

    // Null rather than 0 when no indexer reported a seeder count at all --
    // "0 with seeders" would read as "everything here is dead", which is a
    // different and much worse claim than "nobody told us".
    const seededCount = $derived(
        releases.some((r) => r.seeders !== null && r.seeders !== undefined)
            ? releases.filter((r) => (r.seeders ?? 0) > 0).length
            : null
    );
    const rejectedCount = $derived(releases.filter((r) => r.is_blacklisted).length);
</script>

<!--
    Candidate releases: every release the scrapers found for
    this title. Shown whether or not something is downloaded,
    because swapping to a different release is the whole point
    of the list -- hiding it once one succeeded left no way to
    say "not that one, this one".
-->
{#if releases.length}
    <Collapsible.Root bind:open={releasesOpen} class="mt-2">
        <!--
            Collapsed by default. The list is long, technical,
            and irrelevant until something has gone wrong -- but
            when it is wanted it is wanted badly, so the trigger
            is styled in the primary colour like Play rather
            than as another muted heading, and it carries the
            counts that say whether opening it is worth it.
        -->
        <Collapsible.Trigger
            class="border-primary/30 bg-primary/10 hover:bg-primary/20 focus-visible:ring-ring flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none">
            <LayersIcon class="text-primary size-4 shrink-0" />
            <span class="min-w-0 flex-1">
                <span class="text-primary block text-sm font-semibold">
                    Candidate releases
                </span>
                <span class="text-muted-foreground block text-xs">
                    {releases.length} found{#if seededCount !== null}, {seededCount}
                        with seeders{/if}{#if rejectedCount}
                        &middot; {rejectedCount} rejected{/if}
                </span>
            </span>
            <ChevronDownIcon
                class={cn(
                    "text-primary size-4 shrink-0 transition-transform duration-200",
                    releasesOpen && "rotate-180"
                )} />
        </Collapsible.Trigger>

        <Collapsible.Content>
            <div class="flex flex-col gap-2 pt-2">
                <div class="divide-border/40 flex flex-col divide-y">
                    {#each releases as release (release.infohash)}
                        <div
                            class="flex flex-col gap-2 py-2 sm:flex-row sm:items-start sm:gap-3">
                            <div class="flex shrink-0 gap-1.5">
                                <Badge
                                    variant={release.resolution
                                        ? "secondary"
                                        : "outline"}
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
                                    {#if release.is_downloaded && !release.is_active}
                                        <Badge
                                            variant="outline"
                                            class="border-emerald-500/50 text-[10px] text-emerald-500">
                                            Available alternate
                                        </Badge>
                                    {/if}
                                    {#if release.is_downloading}
                                        <Badge
                                            class="border-0 bg-amber-600/90 text-[10px] text-white">
                                            Downloading in background
                                        </Badge>
                                    {/if}
                                    {#if release.is_preferred && !release.is_active && !release.is_downloading}
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
                                Same component as the manual
                                scrape results, so a release
                                reads identically wherever the
                                choice is being made.
                            -->
                                    <ReleaseMeta
                                        seeders={release.seeders}
                                        leechers={release.leechers}
                                        size={release.size}
                                        indexer={release.indexer} />
                                    <span
                                        class="text-muted-foreground/60 font-mono text-[10px]">
                                        rank {release.rank}
                                    </span>
                                </div>
                            </div>

                            {#if !release.is_active && rivenId}
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
                                        value={rivenId} />
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
                                            <LoaderIcon
                                                class="size-3 animate-spin" />
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
                                        {release.is_blacklisted
                                            ? "Retry"
                                            : "Use this"}
                                    </Button>
                                </form>
                            {/if}
                        </div>
                    {/each}
                </div>

                <p class="text-muted-foreground/70 text-xs">
                    Seeders, size and indexer are what the indexer claimed when this
                    title was scraped, not a live reading. Releases Riven gave up on
                    stay listed so you can retry them; choosing one replaces the
                    current download and keeps the rest of this list.
                </p>
            </div>
        </Collapsible.Content>
    </Collapsible.Root>
{/if}
