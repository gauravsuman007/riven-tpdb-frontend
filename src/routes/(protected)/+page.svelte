<script lang="ts">
    import type { PageData } from "./$types";
    import TmdbNowPlaying from "$lib/components/tmdb-now-playing.svelte";
    import ListCarousel from "$lib/components/list-carousel.svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import { MediaListStore, type BaseListItem } from "$lib/services/lists-cache.svelte";
    import PageShell from "$lib/components/page-shell.svelte";
    import { HOME_ROWS } from "$lib/tv/manifest";
    import { fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";

    let { data }: { data: PageData } = $props();

    const viewAllButtonClass =
        "text-muted-foreground border-white/10 bg-black/20 hover:bg-black/40 hover:text-foreground h-9 w-24 rounded-xl border text-xs font-bold backdrop-blur-md shadow-inner transition-all";

    /*
        The rows come from `$lib/tv/manifest`, not from this file.

        They are drawn twice -- here, and by `riven-tv` on the television,
        which cannot run this bundle and renders its own markup over the
        same API. Two hand-maintained lists drift, and the drift is silent:
        a row added here was simply absent there until somebody remembered.
        Add, remove, retitle or reorder a row in the manifest and both
        surfaces follow.

        No initialData on any of them: each store fetches on mount, so the
        server load no longer blocks first paint on a library round trip.
    */
    const rows = HOME_ROWS.map((row) => ({
        row,
        store: new MediaListStore<BaseListItem>(row.key, row.endpoint, null, {
            noCache: row.noCache ?? false
        })
    }));
</script>

{#snippet listHeading(title: string)}
    <div class="flex items-center gap-3">
        <div class="bg-primary h-6 w-1 rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]">
        </div>
        <h2 class="text-foreground text-2xl font-bold tracking-tight drop-shadow-md">
            {title}
        </h2>
    </div>
{/snippet}

<svelte:head>
    <title>Home - Riven TPDB</title>
</svelte:head>

<PageShell
    class="bg-background relative mt-0 flex min-h-dvh flex-col overflow-x-hidden p-0 pb-24 md:mt-0 md:p-0">
    <!-- Immersive Background -->
    <div class="pointer-events-none fixed inset-0 z-0">
        <div class="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black"></div>
        <div
            class="bg-primary/5 absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full blur-[120px]">
        </div>
        <div
            class="absolute right-[-5%] bottom-[-10%] h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-[100px]">
        </div>
    </div>

    <div class="relative z-10 flex w-full flex-col gap-10 pb-24 md:gap-12">
        <div
            in:fly|global={{ y: 20, duration: 400, delay: 0, easing: cubicOut }}
            class="w-full px-4 md:px-8">
            <TmdbNowPlaying
                data={data.nowPlaying}
                heightClass="h-[50vh] min-h-[500px] max-h-[800px]" />
        </div>

        <div class="mx-auto flex w-full max-w-[2400px] flex-col gap-12 px-6 md:px-12 lg:px-16">
            {#each rows as { row, store }, index (row.key)}
                <!--
                    An empty row is not drawn. A heading over nothing reads
                    as a feed that broke rather than one that is still
                    loading, and every one of these arrives on its own.
                -->
                {#if store.items.length}
                    <div
                        class="flex flex-col gap-4"
                        in:fly|global={{
                            y: 20,
                            duration: 400,
                            delay: 100 + index * 50,
                            easing: cubicOut
                        }}>
                        <div class="mb-1 flex items-center justify-between">
                            {@render listHeading(row.title)}
                            {#if row.viewAll}
                                <Button
                                    class={viewAllButtonClass}
                                    variant="ghost"
                                    href={row.viewAll}>View All</Button>
                            {/if}
                        </div>
                        <ListCarousel data={store.items} />
                    </div>
                {/if}
            {/each}
        </div>
    </div>
</PageShell>
