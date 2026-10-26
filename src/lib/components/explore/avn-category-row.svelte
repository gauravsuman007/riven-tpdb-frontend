<!--
    The AVN awards as ten broad groups, story-driven first. Opening one lists
    every winner in it from every ceremony, newest first.

    Titles only. The backend drops awards that go to a person, and rows whose
    title turned out to be a person's name, so a performer can never be shown
    here as if they were a film.
-->
<script lang="ts">
    import { resolve } from "$app/paths";
    import type { AvnCategory } from "$lib/collections";
    import PosterImage from "$lib/components/media/poster-image.svelte";
    import TrophyIcon from "@lucide/svelte/icons/trophy";

    let { categories }: { categories: AvnCategory[] } = $props();

    const span = (c: AvnCategory) =>
        c.first_year && c.last_year && c.first_year !== c.last_year
            ? `${c.first_year}–${c.last_year}`
            : String(c.last_year ?? c.first_year ?? "");
</script>

<section class="flex flex-col gap-4">
    <div class="flex items-end justify-between gap-4">
        <div class="space-y-1">
            <h2 class="font-serif text-2xl font-medium tracking-tight text-white/90">
                AVN award winners
            </h2>
            <p class="text-sm text-zinc-400">
                Every ceremony's winners, by kind. Open one for all its winners, newest first.
            </p>
        </div>
        <a
            href={resolve("/explore/awards")}
            class="shrink-0 font-mono text-xs text-zinc-400 transition-colors hover:text-white">
            By year →
        </a>
    </div>

    <ul class="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:thin]">
        {#each categories as category (category.key)}
            <li class="w-[150px] shrink-0 snap-start md:w-[180px]">
                <a
                    href={resolve(`/explore/awards/category/${category.key}`)}
                    class="group flex flex-col gap-2 focus-visible:outline-none">
                    <div
                        class="relative aspect-[3/4] overflow-hidden rounded-xl border border-white/15 bg-zinc-900 transition-all group-hover:border-white/40 group-focus-visible:ring-2 group-focus-visible:ring-white">
                        {#if category.poster_path}
                            <PosterImage
                                src={category.poster_path}
                                alt=""
                                class="opacity-70 transition-all duration-500 group-hover:scale-105 group-hover:opacity-90">
                                {#snippet fallback()}
                                    <div class="h-full bg-zinc-900"></div>
                                {/snippet}
                            </PosterImage>
                        {/if}

                        <div
                            class="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-10">
                            <TrophyIcon class="size-4 text-amber-400" aria-hidden="true" />
                            <p class="line-clamp-3 text-sm leading-snug font-medium text-white">
                                {category.name}
                            </p>
                        </div>
                    </div>

                    <p class="line-clamp-2 text-xs text-zinc-400" title={category.description}>
                        {category.description}
                    </p>
                    <p class="truncate font-mono text-xs text-zinc-500">
                        {category.winners} winners · {span(category)}
                    </p>
                </a>
            </li>
        {/each}
    </ul>
</section>
