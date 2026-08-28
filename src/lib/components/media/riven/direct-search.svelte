<!--
    Search streaming sites for this title and play a result directly.

    Deliberately a separate path from the candidate releases below it. Those go
    through a torrent, a debrid provider and the VFS before anything can be
    watched; these are already-hosted files that play immediately and are never
    added to the library. When a scene has no seeded release anywhere -- which
    for this catalogue is common -- this is the difference between watching it
    and not.

    Collapsed until asked for, because each search hits eight sites live and
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
    import VpnRouteBanner from "$lib/components/media/riven/vpn-route-banner.svelte";
    import { getVpnStatus, routeState, type VpnStatus } from "$lib/vpn";
    import { onMount } from "svelte";

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
        hd: boolean;
        relevance: number | null;
    }

    interface Props {
        /** Shown in the trigger and the player's title bar. */
        title: string;
        /**
         * Riven item id, when the title is in the library. Passed in
         * preference to the raw title so the backend can read the cast and
         * studio: the sites rarely carry the exact scene under the exact name,
         * and a credited performer in an upload's title is what tells the
         * right series apart from unrelated clips.
         *
         * Absent for a title that has not been added yet, which still gets a
         * search -- just one matched on the title alone.
         */
        itemId?: number | null;
    }

    let { title, itemId = null }: Props = $props();

    let open = $state(false);
    let loading = $state(false);
    let searched = $state(false);
    /*
        A search term the user typed, used instead of the title (or the item's
        cast and studio) when set. The sites carry the same scene under wildly
        inconsistent names, so when the automatic search finds nothing the
        difference between watching a title and not is usually one hand-typed
        phrase.
    */
    let customQuery = $state("");
    let results = $state<DirectResult[]>([]);
    let siteErrors = $state<Record<string, string>>({});
    let failure = $state<string | null>(null);

    /*
        Fetched on mount rather than only when the panel opens: whether search
        is blocked has to be known before the trigger and the custom-search
        row render, since those are visible (and have to be disabled) even
        while the panel itself is collapsed.
    */
    let vpnStatus = $state<VpnStatus | null>(null);

    async function refreshVpnStatus() {
        vpnStatus = await getVpnStatus();
    }

    onMount(refreshVpnStatus);

    const scrapeRoute = $derived(routeState(vpnStatus, "scraping"));
    const streamRoute = $derived(routeState(vpnStatus, "streaming"));

    /**
     * Tiers a site's row sorts by ahead of relevance -- has to match the
     * backend's `DirectScraperService.SITE_TIERS` exactly, or the same search
     * would look differently prioritised depending on which list you looked
     * at. A site not listed here falls back to tier 2, same as the backend.
     */
    const SITE_TIERS: Record<string, number> = {
        tnaflix: 0,
        eporner: 0,
        hqporner: 1,
        paradisehill: 1,
        tubepornclassic: 1
    };
    const siteTier = (site: string) => SITE_TIERS[site] ?? 2;

    /**
     * Results grouped into one row per site.
     *
     * A single ranked list hid which site a result came from until you read
     * the badge, and made a site that returned nothing indistinguishable from
     * one that was never searched. Row order follows the best result each site
     * produced, so the strongest source is still at the top -- except that a
     * lower-tier site's row always comes first, whatever its relevance.
     */
    const rows = $derived.by(() => {
        const grouped = new Map<string, { name: string; items: DirectResult[] }>();
        for (const result of results) {
            const row = grouped.get(result.site) ?? { name: result.site_name, items: [] };
            row.items.push(result);
            grouped.set(result.site, row);
        }
        return [...grouped.entries()]
            .map(([site, row]) => ({ site, ...row }))
            .sort((a, b) => {
                const tierDiff = siteTier(a.site) - siteTier(b.site);
                if (tierDiff) return tierDiff;
                return (b.items[0]?.relevance ?? 0) - (a.items[0]?.relevance ?? 0);
            });
    });

    async function search() {
        loading = true;
        failure = null;

        /*
            A typed term wins over item_id. Passing both would let the backend
            keep matching on the item's cast and studio, which is exactly the
            matching the user is overriding by typing something else.
        */
        const typed = customQuery.trim();
        const query = typed
            ? `query=${encodeURIComponent(typed)}`
            : itemId
              ? `item_id=${itemId}`
              : `query=${encodeURIComponent(title)}`;

        try {
            // No explicit limit: the backend falls back to the Plugins tab's
            // "Results per site" setting, which is what the user actually
            // wants adjustable without a code change.
            const response = await fetch(`/api/v1/direct/search?${query}`);
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

    /*
        Always re-runs, unlike opening the panel. The user typed a new term and
        is asking for it to be tried; reusing the previous results because a
        search had already happened would look like the button did nothing.
    */
    /** What the last/next search actually looks for -- the typed term wins. */
    const searchedFor = $derived(customQuery.trim() || title);

    function runCustomSearch() {
        if (scrapeRoute.blocked) return;
        open = true;
        if (!loading) search();
    }

    function toggle(next: boolean) {
        // Belt and braces alongside the trigger's own `disabled`: a stale
        // click event queued just as the tunnel drops must not still open the
        // panel and fire a search that is about to be refused server-side too.
        if (next && scrapeRoute.blocked) return;

        open = next;
        // Search on first open rather than on mount: eight live site requests
        // is not something to spend on every page view.
        if (next && !searched && !loading) search();
    }

    function play(result: DirectResult) {
        // Belt and braces alongside the button's own `disabled` and
        // `pointer-events-none`: nothing here should ever reach the player
        // while streaming is routed through a tunnel that is not up.
        if (streamRoute.blocked) return;

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

<Collapsible.Root {open} onOpenChange={toggle} disabled={scrapeRoute.blocked} class="mt-2">
  <div class="flex flex-col gap-2 sm:flex-row sm:items-stretch">
    <Collapsible.Trigger
        disabled={scrapeRoute.blocked}
        class={cn(
            "border-primary/30 bg-primary/10 hover:bg-primary/20 focus-visible:ring-ring flex w-full flex-1 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
            scrapeRoute.blocked && "cursor-not-allowed opacity-50 hover:bg-primary/10"
        )}>
        <GlobeIcon class="text-primary size-4 shrink-0" />
        <span class="min-w-0 flex-1">
            <span class="text-primary block text-sm font-semibold">Watch from a site</span>
            <span class="text-muted-foreground block text-xs">
                {#if loading}
                    Searching&hellip;
                {:else if searched}
                    {results.length} found{#if rows.length}
                        &middot; {rows.map((r) => `${r.name} ${r.items.length}`).join(", ")}{/if}
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

    <!--
        Sits beside the trigger rather than inside the panel: when the
        automatic search misses, the user needs to retype without first
        opening a panel full of the wrong results.
    -->
    <div class="flex items-center gap-1.5">
        <input
            type="search"
            bind:value={customQuery}
            onkeydown={(e) => e.key === "Enter" && !scrapeRoute.blocked && runCustomSearch()}
            placeholder="Custom search term"
            aria-label="Custom search term for streaming sites"
            disabled={scrapeRoute.blocked}
            class="border-border/60 bg-background focus:border-primary/50 h-full min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:w-48 sm:flex-none" />
        <Button
            type="button"
            variant="secondary"
            size="sm"
            class="h-full shrink-0"
            disabled={loading || !customQuery.trim() || scrapeRoute.blocked}
            onclick={runCustomSearch}>
            <SearchIcon class="size-4" aria-hidden="true" />
            <span class="sr-only">Search sites for this term</span>
        </Button>
    </div>
  </div>

  <!-- One line at the bottom of the row, saying how the search is routed. -->
  <div class="mt-1.5">
    <VpnRouteBanner
        purpose="scraping"
        route={scrapeRoute}
        gerund="Searching"
        base="Search"
        size="sm"
        onDisabled={refreshVpnStatus} />
  </div>

    <Collapsible.Content>
        <div class="pt-2">
            <!--
                Bigger and at the top: this is the moment that decides whether
                clicking a result below will actually play anything, so it has
                to be seen before the results, not discovered by clicking a
                faded-out thumbnail.
            -->
            {#if searched && !loading}
                <div class="mb-4">
                    <VpnRouteBanner
                        purpose="streaming"
                        route={streamRoute}
                        gerund="Streaming"
                        base="Stream"
                        size="lg"
                        onDisabled={refreshVpnStatus} />
                </div>
            {/if}

            {#if loading}
                <div class="text-muted-foreground flex items-center gap-2 py-6 text-sm">
                    <div
                        class="border-muted-foreground/30 border-t-primary size-4 animate-spin rounded-full border-2">
                    </div>
                    Searching eight sites for &ldquo;{searchedFor}&rdquo;&hellip;
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
                        No site had anything for &ldquo;{searchedFor}&rdquo;.
                    </p>
                    <Button variant="outline" size="sm" onclick={search}>
                        <SearchIcon class="mr-2 size-4" />
                        Search again
                    </Button>
                </div>
            {:else if rows.length}
                <div class="flex flex-col gap-6">
                    {#each rows as row (row.site)}
                        <div class="flex flex-col gap-3">
                            <div class="flex items-baseline gap-2">
                                <h4 class="text-sm font-semibold">{row.name}</h4>
                                <span class="text-muted-foreground text-xs">
                                    top {row.items.length}
                                </span>
                            </div>

                            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {#each row.items as result, index (`${result.site}:${result.video_id}`)}
                                    <button
                                        type="button"
                                        disabled={streamRoute.blocked}
                                        onclick={() => !streamRoute.blocked && play(result)}
                                        class={cn(
                                            "group focus-visible:ring-ring border-border/60 hover:border-primary/50 hover:bg-muted/30 flex flex-col overflow-hidden rounded-xl border text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                                            streamRoute.blocked && "pointer-events-none cursor-not-allowed opacity-40 hover:border-border/60"
                                        )}>
                                        <div
                                            class="bg-muted relative aspect-video w-full overflow-hidden">
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
                                                    class="absolute right-2 bottom-2 rounded bg-black/75 px-2 py-0.5 font-mono text-xs text-white tabular-nums">
                                                    {formatDuration(result.duration)}
                                                </span>
                                            {/if}
                                            {#if index === 0}
                                                <span
                                                    class="bg-primary text-primary-foreground absolute top-2 left-2 rounded px-2 py-0.5 text-[11px] font-semibold">
                                                    Best match
                                                </span>
                                            {/if}
                                        </div>

                                        <div class="flex min-w-0 flex-1 flex-col gap-2.5 p-3">
                                            <p
                                                class="line-clamp-2 text-sm leading-relaxed font-medium">
                                                {result.title}
                                            </p>
                                            <div class="mt-auto flex flex-wrap items-center gap-1.5">
                                                <!--
                                                    Resolution and size only where the
                                                    site actually reported them. Most
                                                    advertise a vague "HD" badge that
                                                    covers 720p through 4K, and printing
                                                    that as a resolution would be a claim
                                                    the data cannot support.
                                                -->
                                                {#if result.resolution}
                                                    <Badge
                                                        variant="outline"
                                                        class="font-mono text-[11px]">
                                                        {result.resolution}
                                                    </Badge>
                                                {:else if result.hd}
                                                    <Badge variant="outline" class="text-[11px]">
                                                        HD
                                                    </Badge>
                                                {/if}
                                                {#if result.size}
                                                    <Badge
                                                        variant="outline"
                                                        class="font-mono text-[11px]">
                                                        {formatBytes(result.size)}
                                                    </Badge>
                                                {/if}
                                            </div>
                                        </div>
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}

            {#if Object.keys(siteErrors).length}
                <div class="mt-4 space-y-1 text-xs">
                    {#each Object.entries(siteErrors) as [site, message] (site)}
                        <p class="text-muted-foreground">
                            <span class="text-destructive font-medium">{site}</span>: {message}
                        </p>
                    {/each}
                </div>
            {/if}
        </div>
    </Collapsible.Content>
</Collapsible.Root>
