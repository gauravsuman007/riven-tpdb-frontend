<!--
    One Adult Empire shelf as a row of covers.

    Extracted from the brochure page so the same row can stand on Explore
    without the two drifting apart. They had already started to: the brochure's
    copy of this markup is 90 lines of card, and any fix to it -- a badge, a
    fallback, the "See all" tile -- would otherwise have to be made twice and
    would be made twice differently.

    Nothing here is in the library. These are catalogue rows served from the
    local mirror of the listings; a title becomes a library item only when it
    is requested from its own page.
-->
<script lang="ts">
    import { resolve } from "$app/paths";
    import { entryHref, type BrochureShelf } from "$lib/collections";
    import PosterImage from "$lib/components/media/poster-image.svelte";
    import CheckIcon from "@lucide/svelte/icons/check";
    import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
    import StarIcon from "@lucide/svelte/icons/star";

    let { shelf }: { shelf: BrochureShelf } = $props();
</script>

<section class="flex flex-col gap-4">
    <div class="flex items-end justify-between gap-4">
        <div class="space-y-1">
            <h2 class="font-serif text-2xl font-medium tracking-tight text-white/90">
                {shelf.name}
            </h2>
            {#if shelf.description}
                <p class="text-sm text-zinc-400">{shelf.description}</p>
            {/if}
        </div>
        <span class="shrink-0 font-mono text-xs text-zinc-400">
            {shelf.total.toLocaleString()} titles
        </span>
    </div>

    <ul class="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:thin]">
        {#each shelf.entries as entry (entry.id)}
            <li class="w-[150px] shrink-0 snap-start md:w-[180px]">
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

                        {#if entry.rank}
                            <span
                                class="absolute top-1.5 left-1.5 rounded-md bg-black/80 px-1.5 py-0.5 font-mono text-xs font-semibold text-white">
                                #{entry.rank}
                            </span>
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
                        <p class="truncate text-sm text-white/90 group-hover:text-white">
                            {entry.title}
                        </p>
                        <p
                            class="flex items-center gap-1.5 truncate font-mono text-xs text-zinc-400">
                            {#if entry.rating}
                                <StarIcon
                                    class="size-3 fill-amber-400 text-amber-400"
                                    aria-hidden="true" />
                                {entry.rating.toFixed(2)}
                            {/if}
                            {#if entry.year}
                                <span>{entry.year}</span>
                            {/if}
                        </p>
                    </div>
                </a>
            </li>
        {/each}

        {#if shelf.total > shelf.entries.length}
            <li class="flex w-[150px] shrink-0 snap-start items-center md:w-[180px]">
                <a
                    href={resolve(`/collections/${shelf.key}`)}
                    class="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/25 text-zinc-300 transition-colors hover:border-white/50 hover:text-white">
                    <ChevronRightIcon class="size-6" aria-hidden="true" />
                    <span class="font-mono text-xs">See all</span>
                </a>
            </li>
        {/if}
    </ul>
</section>
