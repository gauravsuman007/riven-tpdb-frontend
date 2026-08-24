<!--
    Search streaming sites for this title and play a result directly.

    Deliberately a separate path from the candidate releases below it. Those go
    through a torrent, a debrid provider and the VFS before anything can be
    watched; these are already-hosted files that play immediately and are never
    added to the library. When a scene has no seeded release anywhere -- which
    for this catalogue is common -- this is the difference between watching it
    and not.

    Collapsed until asked for, because each search hits three sites live and
    takes a few seconds. Nothing runs on page load.
-->
<script lang="ts">
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Collapsible from "$lib/components/ui/collapsible/index.js";
    import { formatBytes } from "$lib/helpers";
    import { player } from "$lib/stores/player.svelte";
    import { cn } from "$lib/utils";
    import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
    import GlobeIcon from "@lucide/svelte/icons/globe";
    import PlayIcon from "@lucide/svelte/icons/play";
    import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
    import SearchIcon from "@lucide/svelte/icons/search";

    interface DirectResult {
        site: string;
        site_name: string;
        video_id: string;
        title: string;
        page_url: string;
        thumbnail: string | null;
        duration: number | null;
        resolution: string | null;
        size: number | null;
        views: number | null;
    }

    interface Props {
        /** Used as the search term, and shown in the player's title bar. */
        title: string;
    }

    let { title }: Props = $props();

    let open = $state(false);
    let loading = $state(false);
    let searched = $state(false);
    let results = $state<DirectResult[]>([]);
    let siteErrors = $state<Record<string, string>>({});
    let failure = $state<string | null>(null);

    const bySite = $derived.by(() => {
        const counts = new Map<string, number>();
        for (const result of results) {
            counts.set(result.site_name, (counts.get(result.site_name) ?? 0) + 1);
        }
        return [...counts.entries()];
    });

    async function search() {
        loading = true;
        failure = null;

        try {
            const response = await fetch(
                `/api/v1/direct/search?query=${encodeURIComponent(title)}&limit=20`
            );
            if (!response.ok) throw new Error(`Search returned ${response.status}`);

            const payload = await response.json();
            results = payload.results ?? [];
            // A site being down is normal here and must be visible, otherwise
            // "fewer results than usual" is indistinguishable from "that site
            // has nothing".
            siteErrors = payload.errors ?? {};
            searched = true;
        } catch (e) {
            failure = e instanceof Error ? e.message : "Search failed";
        } finally {
            loading = false;
        }
    }

    function toggle(next: boolean) {
        open = next;
        // Search on first open rather than on mount: three live site requests
        // is not something to spend on every page view.
        if (next && !searched && !loading) search();
    }

    function play(result: DirectResult) {
        const src =
            `/api/direct/stream?site=${encodeURIComponent(result.site)}` +
            `&video_id=${encodeURIComponent(result.video_id)}`;
        // The mime type is not known until the backend resolves the source, and
        // the proxy reports the real one on the response. MP4 is the right
        // opening guess; the player falls back if the element rejects it.
        player.openDirect(src, result.title, "video/mp4", result.thumbnail ?? undefined);
    }

    function formatDuration(seconds: number | null): string | null {
        if (!seconds) return null;
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const rest = seconds % 60;
        return hours
            ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
            : `${minutes}:${String(rest).padStart(2, "0")}`;
    }
</script>

<Collapsible.Root {open} onOpenChange={toggle} class="mt-2">
    <Collapsible.Trigger
        class="border-primary/30 bg-primary/10 hover:bg-primary/20 focus-visible:ring-ring flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none">
        <GlobeIcon class="text-primary size-4 shrink-0" />
        <span class="min-w-0 flex-1">
            <span class="text-primary block text-sm font-semibold">Watch from a site</span>
            <span class="text-muted-foreground block text-xs">
                {#if loading}
                    Searching&hellip;
                {:else if searched}
                    {results.length} found{#if bySite.length}
                        &middot; {bySite.map(([name, n]) => `${name} ${n}`).join(", ")}{/if}
                {:else}
                    Search streaming sites and play without downloading
                {/if}
            </span>
        </span>
        <ChevronDownIcon
            class={cn(
                "text-primary size-4 shrink-0 transition-transform duration-200",
                open && "rotate-180"
            )} />
    </Collapsible.Trigger>

    <Collapsible.Content>
        <div class="pt-2">
            {#if loading}
                <div class="text-muted-foreground flex items-center gap-2 py-6 text-sm">
                    <div
                        class="border-muted-foreground/30 border-t-primary size-4 animate-spin rounded-full border-2">
                    </div>
                    Searching three sites for &ldquo;{title}&rdquo;&hellip;
                </div>
            {:else if failure}
                <div class="flex flex-col items-start gap-2 py-4">
                    <p class="text-destructive text-sm">{failure}</p>
                    <Button variant="outline" size="sm" onclick={search}>
                        <RotateCcwIcon class="mr-2 size-4" />
                        Try again
                    </Button>
                </div>
            {:else if searched && !results.length}
                <div class="flex flex-col items-start gap-2 py-4">
                    <p class="text-muted-foreground text-sm">
                        No site had anything for &ldquo;{title}&rdquo;.
                    </p>
                    <Button variant="outline" size="sm" onclick={search}>
                        <SearchIcon class="mr-2 size-4" />
                        Search again
                    </Button>
                </div>
            {:else if results.length}
                <div
                    class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {#each results as result (`${result.site}:${result.video_id}`)}
                        <button
                            type="button"
                            onclick={() => play(result)}
                            class="group focus-visible:ring-ring border-border/60 hover:border-primary/50 flex flex-col overflow-hidden rounded-lg border text-left transition-colors focus-visible:ring-2 focus-visible:outline-none">
                            <div class="bg-muted relative aspect-video w-full overflow-hidden">
                                {#if result.thumbnail}
                                    <img
                                        src={result.thumbnail}
                                        alt=""
                                        loading="lazy"
                                        referrerpolicy="no-referrer"
                                        class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
                                {/if}
                                <div
                                    class="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                                    <PlayIcon
                                        class="size-8 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                                </div>
                                {#if formatDuration(result.duration)}
                                    <span
                                        class="absolute right-1.5 bottom-1.5 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[11px] text-white tabular-nums">
                                        {formatDuration(result.duration)}
                                    </span>
                                {/if}
                            </div>

                            <div class="flex min-w-0 flex-1 flex-col gap-1.5 p-2">
                                <p class="line-clamp-2 text-xs leading-snug font-medium">
                                    {result.title}
                                </p>
                                <div class="mt-auto flex flex-wrap items-center gap-1">
                                    <Badge variant="secondary" class="text-[11px]">
                                        {result.site_name}
                                    </Badge>
                                    <!--
                                        Resolution and size are only shown when
                                        the site actually reported them. Most
                                        sites only advertise a vague "HD" badge,
                                        and printing that as "1080p" would be a
                                        claim the data does not support.
                                    -->
                                    {#if result.resolution}
                                        <Badge variant="outline" class="font-mono text-[11px]">
                                            {result.resolution}
                                        </Badge>
                                    {/if}
                                    {#if result.size}
                                        <Badge variant="outline" class="font-mono text-[11px]">
                                            {formatBytes(result.size)}
                                        </Badge>
                                    {/if}
                                </div>
                            </div>
                        </button>
                    {/each}
                </div>
            {/if}

            {#if Object.keys(siteErrors).length}
                <p class="text-muted-foreground mt-3 text-xs">
                    Could not reach: {Object.keys(siteErrors).join(", ")}
                </p>
            {/if}
        </div>
    </Collapsible.Content>
</Collapsible.Root>
