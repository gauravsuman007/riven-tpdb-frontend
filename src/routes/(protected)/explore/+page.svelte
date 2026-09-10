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
    import type { Recommendation } from "$lib/recommendations";
    import PosterImage from "$lib/components/media/poster-image.svelte";
    import PageShell from "$lib/components/page-shell.svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import StarIcon from "@lucide/svelte/icons/star";
    import CheckIcon from "@lucide/svelte/icons/check";
    import InfoIcon from "@lucide/svelte/icons/info";
    import SparklesIcon from "@lucide/svelte/icons/sparkles";
    import TagsIcon from "@lucide/svelte/icons/tags";

    let { data, form }: PageProps = $props();

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
                            <InfoIcon class="mt-0.5 size-4 shrink-0 text-white/50" aria-hidden="true" />
                            <span>{notice}</span>
                        </li>
                    {/each}
                </ul>
            {/if}

            {#if data.vocabulary && !data.vocabulary.ingested}
                <div
                    class="flex flex-col items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-4">
                    <div class="flex items-center gap-2 text-sm text-white/90">
                        <TagsIcon class="size-4" aria-hidden="true" />
                        StashDB's tag vocabulary has not been read yet.
                    </div>
                    <p class="max-w-2xl font-mono text-xs text-zinc-400">
                        It is what lets an intent like “outdoors” or “believable” be answered by
                        tag rather than by guesswork — about 3,000 curated tags, grouped. Around
                        thirty calls, once; the graph barely moves afterwards.
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
                            {#if rail.kind === "scenes"}
                                <span class="shrink-0 font-mono text-xs text-zinc-400">
                                    StashDB · browse only
                                </span>
                            {/if}
                        </div>

                        <ul
                            class="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:thin]">
                            {#each rail.items as item (item.key)}
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
                                                {#if item.rating}
                                                    <StarIcon
                                                        class="size-3 fill-amber-400 text-amber-400"
                                                        aria-hidden="true" />
                                                    {item.rating.toFixed(2)}
                                                {/if}
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
                    </section>
                {/each}
            </div>
        {:catch}
            <p class="py-24 text-center text-zinc-300">
                Could not reach the recommendation engine.
            </p>
        {/await}
    </div>
</PageShell>
