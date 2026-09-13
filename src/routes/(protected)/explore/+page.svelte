<!--
    "For you": the ranked rails.

    Every card carries the reasons it is here. That is the point of the whole
    engine rather than a flourish -- a recommendation nobody can interrogate is
    one nobody can correct, and the ranking is built out of readable intent
    expressions precisely so it can be argued with.

    Scene rails come from StashDB and have no request path yet: a StashDB scene
    is not a collection entry, so there is nothing to promote into the library.
    They are labelled as a browsing surface rather than being given a button
    that would not work.
-->
<script lang="ts">
    import type { PageProps } from "./$types";
    import { enhance } from "$app/forms";
    import { resolve } from "$app/paths";
    import { entryHref } from "$lib/collections";
    import type { Rail, RailSort, Recommendation } from "$lib/recommendations";
    import RailControls from "$lib/components/rail-controls.svelte";
    import PosterImage from "$lib/components/media/poster-image.svelte";
    import PageShell from "$lib/components/page-shell.svelte";
    import ShelfRow from "$lib/components/explore/shelf-row.svelte";
    import StudioRow from "$lib/components/explore/studio-row.svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import RatingBadge from "$lib/components/media/rating-badge.svelte";
    import CheckIcon from "@lucide/svelte/icons/check";
    import InfoIcon from "@lucide/svelte/icons/info";
    import BookOpenIcon from "@lucide/svelte/icons/book-open";
    import SparklesIcon from "@lucide/svelte/icons/sparkles";
    import TagsIcon from "@lucide/svelte/icons/tags";

    let { data, form }: PageProps = $props();

    /*
        Per-rail overrides, keyed by rail key.

        A rail is left exactly as the page load ranked it until someone touches
        its controls; only then does an entry appear here. That way a failed
        re-rank can fall back to the row that was already on screen instead of
        blanking a row that was fine a moment ago.
    */
    interface RailView {
        minRating: number;
        sort: RailSort;
        items?: Recommendation[];
        busy: boolean;
        error?: string;
    }

    let views = $state<Record<string, RailView>>({});

    function view(rail: Rail): RailView {
        return views[rail.key] ?? { minRating: 0, sort: "score", busy: false };
    }

    function itemsFor(rail: Rail): Recommendation[] {
        return views[rail.key]?.items ?? rail.items;
    }

    async function adjust(rail: Rail, next: { minRating: number; sort: RailSort }) {
        const current = view(rail);

        views[rail.key] = { ...current, ...next, busy: true, error: undefined };

        const query = new URLSearchParams({
            engine: rail.kind,
            sort: next.sort,
            limit: "20"
        });

        if (rail.intent) {
            query.set("intent", rail.intent);
        }

        if (next.minRating > 0) {
            query.set("min_rating", String(next.minRating));
        }

        try {
            const response = await fetch(`/explore/rail?${query}`);

            if (!response.ok) {
                throw new Error(String(response.status));
            }

            const body = (await response.json()) as { items: Recommendation[] };

            views[rail.key] = { ...next, items: body.items, busy: false };
        } catch {
            // The previously ranked items are kept. A rail that empties itself
            // because a request failed would read as "nothing matches", which
            // is a claim about the catalogue rather than about the network.
            views[rail.key] = {
                ...views[rail.key],
                busy: false,
                error: "Could not re-rank this row."
            };
        }
    }

    /*
        A scene has no entry to open. Linking it anywhere would be a lie about
        what the app can do with it, so the card is inert -- deliberately, and
        the rail says why.
    */
    function href(item: Recommendation): string | undefined {
        if (item.entry_id === null) {
            return undefined;
        }

        return entryHref({
            id: item.entry_id,
            tpdb_id: item.tpdb_id,
            tpdb_kind: item.kind === "scene" ? "scene" : "movie"
        });
    }

    /** The strongest signal behind a title, for the badge on its card. */
    function topSignal(item: Recommendation): string | null {
        const entries = Object.entries(item.signals);

        if (!entries.length) {
            return null;
        }

        const [name] = entries.reduce((best, next) => (next[1] > best[1] ? next : best));
        const labels: Record<string, string> = {
            awards: "Award-winning",
            rating: "Highly rated",
            demand: "Best-selling",
            recency: "New",
            affinity: "Like your library",
            intent: "Matches"
        };

        return labels[name] ?? null;
    }
</script>

<svelte:head>
    <title>Explore · Riven</title>
</svelte:head>

<PageShell class="bg-background relative flex flex-col overflow-x-hidden !pt-6">
    <div class="pointer-events-none fixed inset-0 z-0">
        <div class="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black"></div>
        <div
            class="bg-primary/5 absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full blur-[120px]">
        </div>
    </div>

    <div class="relative z-10 mx-auto flex w-full max-w-[2400px] flex-col gap-10">
        <header class="flex flex-col gap-2">
            <h1 class="font-serif text-5xl font-medium tracking-tight text-white/90 md:text-7xl">
                For you
            </h1>
            <p class="max-w-2xl text-sm text-zinc-400">
                Ranked from award history, storefront ratings and demand, and what your library
                already contains — over titles that are catalogued but not yet yours. Every card
                shows the signals that put it here.
            </p>
        </header>

        {#await data.rows}
            <div class="flex flex-col gap-3 py-24 text-center">
                <p class="text-zinc-300">Ranking the catalogue…</p>
            </div>
        {:then rows}
            {#if rows.notices.length}
                <!--
                    Named, not swallowed. An absent row tells nobody anything;
                    "the scene engine needs a StashDB key" is something a
                    person can act on.
                -->
                <ul class="flex flex-col gap-2">
                    {#each rows.notices as notice (notice)}
                        <li
                            class="flex items-start gap-2 rounded-xl border border-dashed border-white/20 px-4 py-3 text-sm text-zinc-300">
                            <InfoIcon
                                class="mt-0.5 size-4 shrink-0 text-white/50"
                                aria-hidden="true" />
                            <span>{notice}</span>
                        </li>
                    {/each}
                </ul>
            {/if}

            {#if data.categoryIndex && !data.categoryIndex.built}
                <div
                    class="flex flex-col items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-4">
                    <div class="flex items-center gap-2 text-sm text-white/90">
                        <TagsIcon class="size-4" aria-hidden="true" />
                        Movie genres have not been indexed yet.
                    </div>
                    <p class="max-w-2xl font-mono text-xs text-zinc-400">
                        An Adult Empire product page lists length, year, studio and cast — and no
                        genre at all. The genres live in the site's {data.categoryIndex.categories
                            .length} browsable categories instead, so they are read from that side:
                        {data.categoryIndex.categories.join(", ")}. A few minutes of
                        one-request-per-second crawling, in the background.
                    </p>
                    <form method="POST" action="?/indexCategories" use:enhance>
                        <Button
                            type="submit"
                            size="sm"
                            variant="secondary"
                            disabled={data.categoryIndex.running}>
                            <TagsIcon class="mr-2 size-4" aria-hidden="true" />
                            {data.categoryIndex.running ? "Indexing…" : "Index movie genres"}
                        </Button>
                    </form>
                </div>
            {/if}

            {#if data.vocabulary && !data.vocabulary.ingested}
                <div
                    class="flex flex-col items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-4">
                    <div class="flex items-center gap-2 text-sm text-white/90">
                        <TagsIcon class="size-4" aria-hidden="true" />
                        StashDB's tag vocabulary has not been read yet.
                    </div>
                    <p class="max-w-2xl font-mono text-xs text-zinc-400">
                        It is what lets an intent like “outdoors” or “believable” be answered by tag
                        rather than by guesswork — about 3,000 curated tags, grouped. Around thirty
                        calls, once; the graph barely moves afterwards.
                    </p>
                    <form method="POST" action="?/ingest" use:enhance>
                        <Button type="submit" size="sm" variant="secondary">
                            <TagsIcon class="mr-2 size-4" aria-hidden="true" />
                            Read the tag vocabulary
                        </Button>
                    </form>
                    {#if form?.message}
                        <p class="font-mono text-xs text-zinc-300">{form.message}</p>
                    {/if}
                </div>
            {/if}

            {#if !rows.rails.length}
                <div class="flex flex-col items-center gap-3 py-20 text-center">
                    <SparklesIcon class="size-10 text-white/40" aria-hidden="true" />
                    <p class="max-w-lg text-zinc-300">
                        Nothing to rank yet. The engine ranks what has already been catalogued, so
                        it needs one of the sources below to have synced at least once.
                    </p>
                    <div class="flex gap-2">
                        <Button href={resolve("/explore/brochure")} size="sm" variant="secondary">
                            Adult Empire
                        </Button>
                        <Button href={resolve("/explore/awards")} size="sm" variant="secondary">
                            AVN winners
                        </Button>
                    </div>
                    <p class="max-w-lg font-mono text-xs text-zinc-500">
                        The Adult Empire shelves below are not ranked — they are the storefront's
                        own ordering, mirrored locally, and they work before any of this does.
                    </p>
                </div>
            {/if}

            <div class="flex flex-col gap-12 pb-20">
                {#each rows.rails as rail (rail.key)}
                    <section class="flex flex-col gap-4">
                        <div class="flex items-end justify-between gap-4">
                            <div class="space-y-1">
                                <h2
                                    class="font-serif text-2xl font-medium tracking-tight text-white/90">
                                    {rail.title}
                                </h2>
                                <p class="max-w-2xl text-sm text-zinc-400">{rail.reason}</p>
                            </div>
                            <div class="flex shrink-0 flex-col items-end gap-2">
                                <RailControls
                                    minRating={view(rail).minRating}
                                    sort={view(rail).sort}
                                    busy={view(rail).busy}
                                    onChange={(next) => adjust(rail, next)} />
                                {#if rail.kind === "scenes"}
                                    <span class="font-mono text-xs text-zinc-400">
                                        StashDB · browse only
                                    </span>
                                {/if}
                                {#if view(rail).error}
                                    <span class="font-mono text-xs text-amber-400">
                                        {view(rail).error}
                                    </span>
                                {/if}
                            </div>
                        </div>

                        <ul
                            class="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:thin]">
                            {#each itemsFor(rail) as item (item.key)}
                                <li class="w-[150px] shrink-0 snap-start md:w-[180px]">
                                    <svelte:element
                                        this={href(item) ? "a" : "div"}
                                        href={href(item)}
                                        class="group flex flex-col gap-2 focus-visible:outline-none">
                                        <div
                                            class="relative aspect-[3/4] overflow-hidden rounded-xl border border-white/15 bg-zinc-900 transition-all group-hover:border-white/40 group-focus-visible:ring-2 group-focus-visible:ring-white">
                                            {#if item.poster_path}
                                                <PosterImage
                                                    src={item.poster_path}
                                                    alt={item.title}
                                                    class="transition-transform duration-500 group-hover:scale-105">
                                                    {#snippet fallback()}
                                                        <div
                                                            class="flex h-full items-center justify-center p-3 text-center font-mono text-xs text-zinc-500">
                                                            {item.title}
                                                        </div>
                                                    {/snippet}
                                                </PosterImage>
                                            {:else}
                                                <div
                                                    class="flex h-full items-center justify-center p-3 text-center font-mono text-xs text-zinc-500">
                                                    {item.title}
                                                </div>
                                            {/if}

                                            {#if topSignal(item)}
                                                <span
                                                    class="absolute top-1.5 left-1.5 rounded-md bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                                                    {topSignal(item)}
                                                </span>
                                            {/if}

                                            {#if item.requested}
                                                <span
                                                    class="absolute top-1.5 right-1.5 flex items-center gap-1 rounded-md bg-emerald-600/90 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                                                    <CheckIcon class="size-3" aria-hidden="true" />
                                                    In library
                                                </span>
                                            {/if}
                                        </div>

                                        <div class="space-y-0.5">
                                            <p
                                                class="truncate text-sm text-white/90 group-hover:text-white">
                                                {item.title}
                                            </p>
                                            <p
                                                class="flex items-center gap-1.5 truncate font-mono text-xs text-zinc-400">
                                                <RatingBadge rating={item.rating} />
                                                {#if item.year}
                                                    <span>{item.year}</span>
                                                {/if}
                                                {#if item.studio}
                                                    <span class="truncate">{item.studio}</span>
                                                {/if}
                                            </p>
                                            {#if item.reasons.length}
                                                <!--
                                                    The provenance, in the
                                                    engine's own words: which
                                                    award, which facet, whose
                                                    presence in the library.
                                                -->
                                                <p
                                                    class="truncate font-mono text-[10px] text-zinc-500"
                                                    title={item.reasons.join(" · ")}>
                                                    {item.reasons.join(" · ")}
                                                </p>
                                            {/if}
                                        </div>
                                    </svelte:element>
                                </li>
                            {/each}
                        </ul>

                        {#if !itemsFor(rail).length}
                            <!--
                                Only reachable through the controls -- a rail
                                that ranked empty is dropped by the backend.
                                Named rather than left blank, and it names the
                                filter, because "nothing here" and "nothing
                                here at four stars and up" are different facts.
                            -->
                            <p class="py-6 font-mono text-sm text-zinc-400">
                                {#if rail.kind === "scenes"}
                                    StashDB carries no audience ratings, so no scene can meet a
                                    minimum. Set it back to Any.
                                {:else}
                                    Nothing in this row is rated {view(rail).minRating} or higher yet.
                                    Ratings are read from Adult Empire's product pages — run the rating
                                    backfill if you have not.
                                {/if}
                            </p>
                        {/if}
                    </section>
                {/each}
            </div>
        {:catch}
            <p class="py-24 text-center text-zinc-300">
                Could not reach the recommendation engine.
            </p>
        {/await}

        <!--
            THE CATALOGUE ITSELF, under the rails computed from it.

            Below rather than above because the ranked rails are the answer to
            "what should I watch" and these are the raw material -- but on the
            same page, because a reader who does not like the answer wants the
            material, not a tab.

            Each row awaits on its own. The rails can still be ranking while
            these are already drawn, and a failure in one says so where it
            happened instead of taking the page with it.
        -->
        {#await Promise.all([data.studios, data.studioSuggestions])}
            <!--
                A placeholder of the row's own height, so the ranked rails
                above do not jump down by 240px when these land a moment later.
            -->
            <div class="h-[220px] animate-pulse rounded-xl border border-white/5 bg-white/[0.02]"></div>
        {:then [studios, suggestions]}
            <StudioRow {studios} {suggestions} action="?/saveStudio" />
        {/await}

        {#await Promise.all([data.shelves, data.brochure])}
            <div class="h-[320px] animate-pulse rounded-xl border border-white/5 bg-white/[0.02]"></div>
        {:then [shelves, brochure]}
            {#if shelves.length}
                <div class="flex flex-col gap-12 pb-20">
                    <div class="flex flex-wrap items-center gap-2 text-zinc-300">
                        <span class="font-mono text-xs tracking-widest uppercase">
                            Adult Empire
                        </span>
                        <span class="h-px w-8 bg-zinc-700"></span>
                        <span class="font-mono text-sm">
                            {shelves
                                .reduce((sum, shelf) => sum + shelf.total, 0)
                                .toLocaleString()} ranked titles · not in your library
                        </span>
                    </div>

                    {#each shelves as shelf (shelf.key)}
                        <ShelfRow {shelf} />
                    {/each}
                </div>
            {:else if !brochure.enabled}
                <!--
                    Switched off rather than empty, which are different facts
                    and want different buttons. Turning it on is the brochure
                    tab's job -- it is the page that explains what the sync
                    costs -- so this points there rather than duplicating the
                    switch and its explanation.
                -->
                <div
                    class="flex flex-col items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-4">
                    <div class="flex items-center gap-2 text-sm text-white/90">
                        <BookOpenIcon class="size-4" aria-hidden="true" />
                        Adult Empire's listings have not been switched on.
                    </div>
                    <p class="max-w-2xl font-mono text-xs text-zinc-400">
                        All-time bestsellers, current bestsellers, trending and new releases, as
                        rows you can browse — and the studio directory that the row above is
                        picked from. Nothing is downloaded; a title enters your library only when
                        you request it.
                    </p>
                    <Button href={resolve("/explore/brochure")} size="sm" variant="secondary">
                        <BookOpenIcon class="mr-2 size-4" aria-hidden="true" />
                        Set up the brochure
                    </Button>
                </div>
            {:else}
                <p class="pb-20 font-mono text-sm text-zinc-400">
                    The brochure is switched on but its first sync has not landed yet. Covers
                    appear a shelf at a time.
                </p>
            {/if}
        {/await}
    </div>
</PageShell>
