<!--
    The AVN Awards, one row per ceremony year, newest first.

    Blank until switched on, and that is deliberate: building the corpus means
    reading forty Wikipedia articles and then resolving thousands of titles
    against TPDB at two requests a second. That is an hour of background work
    nobody should start by accident.

    Every expected year gets a row immediately, including years the sync has
    not reached — those say "Data being fetched" rather than being omitted. A
    page that grows downwards while a job runs reads as breakage; a page of
    placeholders that fill in reads as progress.
-->
<script lang="ts">
    import type { PageProps } from "./$types";
    import { enhance } from "$app/forms";
    import { resolve } from "$app/paths";
    import PageShell from "$lib/components/page-shell.svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import TrophyIcon from "@lucide/svelte/icons/trophy";
    import CheckIcon from "@lucide/svelte/icons/check";
    import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
    import LoaderIcon from "@lucide/svelte/icons/loader-circle";
    import type { CollectionEntry } from "$lib/collections";

    let { data, form }: PageProps = $props();

    const overview = $derived(data.overview);
    // The form result covers the moment just after enabling, before the poll
    // has brought back a page with years on it.
    const enabled = $derived(overview.enabled || form?.enabled === true);

    const resolved = $derived(overview.progress.matched ?? 0);
    const pending = $derived(overview.progress.pending ?? 0);
    const unmatched = $derived(overview.progress.unmatched ?? 0);
    const total = $derived(resolved + pending + unmatched);

    const requested = $derived(overview.years.reduce((sum, year) => sum + year.requested, 0));
</script>

<!--
    One boxcover. Shared by the linked and unlinked branches above so the two
    cannot drift apart visually.
-->
{#snippet card(entry: CollectionEntry)}
    <div
        class="relative aspect-[3/4] overflow-hidden rounded-xl border border-white/15 bg-zinc-900 transition-all group-hover:border-white/40 group-focus-visible:ring-2 group-focus-visible:ring-white">
        {#if entry.poster_path}
            <img
                src={entry.poster_path}
                alt={entry.title}
                loading="lazy"
                class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        {:else}
            <div
                class="flex h-full items-center justify-center p-3 text-center font-mono text-xs text-zinc-500">
                {entry.title}
            </div>
        {/if}

        {#if entry.requested}
            <span
                class="absolute top-1.5 right-1.5 flex items-center gap-1 rounded-md bg-emerald-600/90 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                <CheckIcon class="size-3" aria-hidden="true" />
                {entry.state ?? "In library"}
            </span>
        {/if}
    </div>

    <div class="space-y-0.5">
        <p class="truncate text-sm text-white/90 group-hover:text-white">{entry.title}</p>
        <!--
            The category is the reason the title is on this page, so it is the
            subtitle rather than the studio.
        -->
        <p class="truncate font-mono text-xs text-amber-400/80">{entry.category ?? "Winner"}</p>
    </div>
{/snippet}

<svelte:head>
    <title>AVN Awards · Riven</title>
</svelte:head>

<PageShell class="bg-background relative flex min-h-screen flex-col overflow-x-hidden">
    <div class="pointer-events-none fixed inset-0 z-0">
        <div class="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black"></div>
        <div
            class="absolute top-[-20%] right-[-10%] h-[600px] w-[600px] rounded-full bg-amber-500/5 blur-[120px]">
        </div>
    </div>

    <div class="relative z-10 mx-auto flex w-full max-w-[2400px] flex-col gap-10">
        <header class="flex flex-col gap-2 pt-32 md:pt-0">
            <h1 class="font-serif text-5xl font-medium tracking-tight text-white/90 md:text-7xl">
                AVN Awards
            </h1>
            <div class="flex flex-wrap items-center gap-2 text-zinc-300">
                <span class="font-mono text-xs tracking-widest uppercase">Winners by year</span>
                {#if enabled && total}
                    <span class="h-px w-8 bg-zinc-700"></span>
                    <span class="font-mono text-sm">
                        {resolved.toLocaleString()} of {total.toLocaleString()} resolved ·
                        {requested.toLocaleString()} in your library
                    </span>
                {/if}
            </div>
        </header>

        {#if !enabled}
            <!--
                The empty state is the whole page until this is switched on.
                Saying what the job actually costs is the point: the button
                starts an hour of rate-limited background work.
            -->
            <div class="flex flex-col items-center gap-4 py-24 text-center">
                <TrophyIcon class="size-10 text-amber-400/70" aria-hidden="true" />
                <p class="max-w-lg text-zinc-300">
                    Every AVN Award winner since 1987, grouped by ceremony year.
                </p>
                <p class="max-w-lg font-mono text-xs text-zinc-400">
                    Building the list reads Wikipedia's per-ceremony articles and then looks each
                    title up on ThePornDB, which allows two requests a second — so the years fill in
                    over roughly an hour rather than all at once. Winners are requested
                    automatically as they resolve; that can be turned off under Settings → Content →
                    Awards.
                </p>

                <form method="POST" action="?/enable" use:enhance>
                    <input type="hidden" name="enabled" value="true" />
                    <Button type="submit" size="lg">
                        <TrophyIcon class="mr-2 size-4" />
                        Fetch AVN award winners
                    </Button>
                </form>

                {#if form?.message}
                    <p class="text-destructive text-xs">{form.message}</p>
                {/if}
            </div>
        {:else}
            {#if form?.message}
                <p class="font-mono text-xs text-zinc-300">{form.message}</p>
            {/if}

            <div class="flex flex-col gap-12 pb-20">
                {#each overview.years as year (year.year)}
                    <section class="flex flex-col gap-4">
                        <div class="flex items-end justify-between gap-4">
                            <div class="space-y-1">
                                <h2
                                    class="font-serif text-2xl font-medium tracking-tight text-white/90">
                                    {year.year}
                                </h2>
                                <p class="font-mono text-xs text-zinc-400">
                                    {#if year.status === "ready"}
                                        {year.total.toLocaleString()} winners ·
                                        {year.matched.toLocaleString()} resolved ·
                                        {year.requested.toLocaleString()} in library
                                    {:else}
                                        Data being fetched
                                    {/if}
                                </p>
                            </div>

                            {#if year.key && year.total > year.entries.length}
                                <a
                                    href={resolve(`/collections/${year.key}`)}
                                    class="shrink-0 font-mono text-xs text-zinc-400 transition-colors hover:text-white">
                                    See all →
                                </a>
                            {/if}
                        </div>

                        {#if year.status !== "ready"}
                            <!--
                                A skeleton row rather than a bare sentence: the
                                year keeps its place in the layout, so nothing
                                shifts underneath the reader when it fills in.
                            -->
                            <div
                                class="flex items-center gap-3 rounded-xl border border-dashed border-white/15 px-4 py-8 text-zinc-400">
                                <LoaderIcon class="size-4 animate-spin" aria-hidden="true" />
                                <span class="font-mono text-xs">Data being fetched…</span>
                            </div>
                        {:else}
                            <ul
                                class="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:thin]">
                                {#each year.entries as entry (entry.id)}
                                    <li class="w-[150px] shrink-0 snap-start md:w-[180px]">
                                        <!--
                                            Two anchors rather than one with a
                                            ternary href: `resolve()` has to be
                                            the whole attribute expression for
                                            the lint rule to see it, and it has
                                            to take a literal route for the
                                            types to narrow. A resolved winner
                                            goes to its TPDB page; an unresolved
                                            one has nowhere to go but the
                                            year's own list.
                                        -->
                                        {#if entry.tpdb_id && entry.tpdb_kind === "scene"}
                                            <a
                                                href={resolve(`/details/tpdb/tv/${entry.tpdb_id}`)}
                                                class="group flex flex-col gap-2 focus-visible:outline-none">
                                                {@render card(entry)}
                                            </a>
                                        {:else if entry.tpdb_id}
                                            <a
                                                href={resolve(
                                                    `/details/tpdb/movie/${entry.tpdb_id}`
                                                )}
                                                class="group flex flex-col gap-2 focus-visible:outline-none">
                                                {@render card(entry)}
                                            </a>
                                        {:else if year.key}
                                            <a
                                                href={resolve(`/collections/${year.key}`)}
                                                class="group flex flex-col gap-2 focus-visible:outline-none">
                                                {@render card(entry)}
                                            </a>
                                        {:else}
                                            <div class="group flex flex-col gap-2">
                                                {@render card(entry)}
                                            </div>
                                        {/if}
                                    </li>
                                {/each}

                                {#if year.key && year.total > year.entries.length}
                                    <li
                                        class="flex w-[150px] shrink-0 snap-start items-center md:w-[180px]">
                                        <a
                                            href={resolve(`/collections/${year.key}`)}
                                            class="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/25 text-zinc-300 transition-colors hover:border-white/50 hover:text-white">
                                            <ChevronRightIcon class="size-6" aria-hidden="true" />
                                            <span class="font-mono text-xs">All categories</span>
                                        </a>
                                    </li>
                                {/if}
                            </ul>
                        {/if}
                    </section>
                {/each}
            </div>
        {/if}
    </div>
</PageShell>
