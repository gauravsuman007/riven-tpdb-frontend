<script lang="ts">
    import type { PageData } from "./$types";
    import TmdbNowPlaying from "$lib/components/tmdb-now-playing.svelte";
    import ListCarousel from "$lib/components/list-carousel.svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import { MediaListStore, type BaseListItem } from "$lib/services/lists-cache.svelte";
    import PageShell from "$lib/components/page-shell.svelte";
    import RailEditor from "$lib/components/rail-editor.svelte";
    import AddonRailRow from "$lib/components/addon-rail.svelte";
    import {
        addonRails,
        arrange,
        builtinHomeRails,
        type RailDef,
        type RailPlacement
    } from "$lib/rails";
    import { fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";

    let { data }: { data: PageData } = $props();

    const viewAllButtonClass =
        "text-muted-foreground border-white/10 bg-black/20 hover:bg-black/40 hover:text-foreground h-9 w-24 rounded-xl border text-xs font-bold backdrop-blur-md shadow-inner transition-all";

    /*
        The rows, and who decides them.

        The CATALOGUE is what this page could draw: its own rows, still
        defined in `$lib/tv/manifest` so that the television -- which cannot
        run this bundle -- keeps rendering from the same list, plus every row
        each installed add-on offers.

        The LAYOUT is what the viewer picked, and it comes from the backend.
        An unarranged page draws the catalogue's own defaults, which is
        exactly what this page did before any of it was arrangeable.
    */
    const catalogue = $derived<RailDef[]>([
        ...builtinHomeRails(),
        ...addonRails(data.addons ?? [])
    ]);

    let layout = $state<RailPlacement[]>([]);

    // Seeded from the load rather than initialised from it, so that saving an
    // arrangement redraws the page without a round trip to the server.
    $effect(() => {
        layout = data.railLayout ?? [];
    });

    const shown = $derived(arrange(catalogue, layout, "home"));

    /*
        One store per row, kept across re-arrangements.

        A `MediaListStore` holds the fetched items and a five-minute cache.
        Rebuilding them whenever the order changes would refetch every feed on
        the page each time somebody moved a row one place, so they are made
        once per key and looked up thereafter.
    */
    const stores = new Map<string, MediaListStore<BaseListItem>>();

    function storeFor(rail: RailDef): MediaListStore<BaseListItem> {
        let store = stores.get(rail.key);

        if (!store) {
            store = new MediaListStore<BaseListItem>(rail.key, rail.endpoint!, null, {
                noCache: rail.noCache ?? false
            });
            stores.set(rail.key, store);
        }

        return store;
    }
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
            <div class="flex justify-end">
                <RailEditor
                    page="home"
                    {catalogue}
                    {layout}
                    onsaved={(saved) => (layout = saved)} />
            </div>

            {#each shown as rail, index (rail.key)}
                {#if rail.source === "built-in"}
                    {@const store = storeFor(rail)}
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
                                {@render listHeading(rail.title)}
                                {#if rail.viewAll}
                                    <Button
                                        class={viewAllButtonClass}
                                        variant="ghost"
                                        href={rail.viewAll}>View All</Button>
                                {/if}
                            </div>
                            <ListCarousel data={store.items} />
                        </div>
                    {/if}
                {:else}
                    <!--
                        An add-on's row, drawn by one renderer that knows
                        nothing about which add-on it is. See `addon-rail`.
                    -->
                    <AddonRailRow
                        title={rail.title}
                        endpoint={rail.endpoint ?? ""}
                        addon={rail.source}
                        description={rail.description} />
                {/if}
            {/each}
        </div>
    </div>
</PageShell>
