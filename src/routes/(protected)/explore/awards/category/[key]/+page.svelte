<!--
    Every winner in one AVN award group, from every ceremony, newest first.

    A group spans many awards (Story & Drama holds Movie of the Year, Best
    Drama, Best Screenplay...), so the winners are split by year and each card
    says which award it won. Titles only; see `avn-category-row.svelte`.
-->
<script lang="ts">
    import type { PageProps } from "./$types";
    import { resolve } from "$app/paths";
    import { entryHref, type CollectionEntry } from "$lib/collections";
    import PageShell from "$lib/components/page-shell.svelte";
    import PosterImage from "$lib/components/media/poster-image.svelte";
    import CheckIcon from "@lucide/svelte/icons/check";
    import TrophyIcon from "@lucide/svelte/icons/trophy";

    let { data }: PageProps = $props();

    const category = $derived(data.category);

    // Entries arrive newest first; keep that order while splitting by year.
    const years = $derived.by(() => {
        const out: { year: number | null; entries: CollectionEntry[] }[] = [];

        for (const entry of data.entries) {
            const last = out.at(-1);

            if (last && last.year === entry.year) last.entries.push(entry);
            else out.push({ year: entry.year, entries: [entry] });
        }

        return out;
    });
</script>

<svelte:head>
    <title>{category.name} - AVN winners</title>
</svelte:head>

<PageShell class="bg-background relative flex min-h-screen flex-col overflow-x-hidden !pt-6">
    <div class="pointer-events-none fixed inset-0 z-0">
        <div class="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black"></div>
        <div
            class="absolute top-[-20%] right-[-10%] h-[600px] w-[600px] rounded-full bg-amber-500/5 blur-[120px]">
        </div>
    </div>

    <div class="relative z-10 mx-auto flex w-full max-w-[2400px] flex-col gap-10">
        <header class="flex flex-col gap-2">
            <a
                href={resolve("/explore")}
                class="w-fit font-mono text-xs text-zinc-400 transition-colors hover:text-white">
                ← Explore
            </a>
            <h1
                class="flex items-center gap-3 font-serif text-4xl font-medium tracking-tight text-white/90 md:text-6xl">
                <TrophyIcon class="size-8 shrink-0 text-amber-400" aria-hidden="true" />
                {category.name}
            </h1>
            <p class="max-w-3xl text-zinc-400">{category.description}</p>
            <p class="font-mono text-xs text-zinc-500">
                {category.winners} winners · {category.first_year}–{category.last_year} · newest first
            </p>
        </header>

        {#each years as group (group.year)}
            <section class="flex flex-col gap-4">
                <h2 class="font-serif text-2xl font-medium tracking-tight text-white/90">
                    {group.year ?? "Undated"}
                </h2>

                <ul
                    class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8">
                    {#each group.entries as entry (entry.id)}
                        <li>
                            <!-- entryHref builds its paths with resolve(); the rule cannot see through it. -->
                            <!-- eslint-disable svelte/no-navigation-without-resolve -->
                            <a
                                href={entryHref(entry)}
                                class="group flex flex-col gap-2 focus-visible:outline-none">
                                <div
                                    class="relative aspect-[3/4] overflow-hidden rounded-xl border border-white/15 bg-zinc-900 transition-all group-hover:border-white/40 group-focus-visible:ring-2 group-focus-visible:ring-white">
                                    {#if entry.poster_path}
                                        <PosterImage
                                            src={entry.poster_path}
                                            alt={entry.title}
                                            class="transition-transform duration-500 group-hover:scale-105">
                                            {#snippet fallback()}
                                                <div
                                                    class="flex h-full items-center justify-center p-3 text-center font-mono text-xs text-zinc-500">
                                                    {entry.title}
                                                </div>
                                            {/snippet}
                                        </PosterImage>
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
                                    <p
                                        class="line-clamp-2 text-sm text-white/90 group-hover:text-white">
                                        {entry.title}
                                    </p>
                                    <!-- The exact award: a group holds several. -->
                                    <p class="line-clamp-2 text-xs text-amber-300/80">
                                        {entry.category}
                                    </p>
                                    {#if entry.studio}
                                        <p class="truncate font-mono text-xs text-zinc-500">
                                            {entry.studio}
                                        </p>
                                    {/if}
                                </div>
                            </a>
                            <!-- eslint-enable svelte/no-navigation-without-resolve -->
                        </li>
                    {/each}
                </ul>
            </section>
        {/each}
    </div>
</PageShell>
