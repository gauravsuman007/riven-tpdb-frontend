<!--
    The brochure: Adult Empire's ranked listings as rows of covers.

    Deliberately a browsing surface rather than a list. Each shelf is a
    horizontally scrolling row of boxcovers, because that is what makes a
    catalogue feel browsable, and rank is shown as a corner badge so the
    ordering is legible without a column of numbers.

    Nothing here is in the library. These are catalogue rows served from the
    local mirror of the listings; a title only becomes a library item when it
    is requested from its own page.
-->
<script lang="ts">
    import type { PageProps } from "./$types";
    import PosterImage from "$lib/components/media/poster-image.svelte";
    import { enhance } from "$app/forms";
    import { resolve } from "$app/paths";
    import { entryHref } from "$lib/collections";
    import { Button } from "$lib/components/ui/button/index.js";
    import BookOpenIcon from "@lucide/svelte/icons/book-open";
    import PageShell from "$lib/components/page-shell.svelte";
    import ShelfRow from "$lib/components/explore/shelf-row.svelte";
    import StudioRow from "$lib/components/explore/studio-row.svelte";
    import StarIcon from "@lucide/svelte/icons/star";
    import CheckIcon from "@lucide/svelte/icons/check";
    import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
    import BuildingIcon from "@lucide/svelte/icons/building-2";
    import PlusIcon from "@lucide/svelte/icons/plus";

    let { data, form }: PageProps = $props();

    const totalTitles = $derived(data.shelves.reduce((sum, shelf) => sum + shelf.total, 0));

    // The form result covers the moment just after enabling, before the first
    // sync has produced anything to show.
    const enabled = $derived(data.status.enabled || form?.enabled === true);
</script>

<svelte:head>
    <title>Brochure · Riven</title>
</svelte:head>

<PageShell class="bg-background relative flex min-h-screen flex-col overflow-x-hidden !pt-6">
    <div class="pointer-events-none fixed inset-0 z-0">
        <div class="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black"></div>
        <div
            class="bg-primary/5 absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full blur-[120px]">
        </div>
    </div>

    <div class="relative z-10 mx-auto flex w-full max-w-[2400px] flex-col gap-10">
        <header class="flex flex-col gap-2">
            <h1 class="font-serif text-5xl font-medium tracking-tight text-white/90 md:text-7xl">
                Brochure
            </h1>
            <div class="flex flex-wrap items-center gap-2 text-zinc-300">
                <span class="font-mono text-xs tracking-widest uppercase">Adult Empire</span>
                <span class="h-px w-8 bg-zinc-700"></span>
                <span class="font-mono text-sm">
                    {totalTitles.toLocaleString()} ranked titles · not in your library
                </span>
            </div>
        </header>

        {#if !enabled}
            <!--
                Off by default, and switched on from here rather than only from
                Settings. Adult Empire is read one page per second by a named
                crawler, so the first sync takes a couple of minutes; saying so
                is better than a button that appears to do nothing.
            -->
            <div class="flex flex-col items-center gap-4 py-24 text-center">
                <BookOpenIcon class="size-10 text-white/50" aria-hidden="true" />
                <p class="max-w-lg text-zinc-300">
                    Adult Empire's ranked listings — all-time bestsellers, current bestsellers,
                    trending and new releases — as rows you can browse.
                </p>
                <p class="max-w-lg font-mono text-xs text-zinc-400">
                    The listings are read one page per second, so the first sync takes a couple of
                    minutes. Covers and rank appear first; ratings, studio and cast arrive on a
                    second pass, one request per title. Nothing is downloaded — a title enters your
                    library only when you request it from its own page.
                </p>

                <form method="POST" action="?/enable" use:enhance>
                    <input type="hidden" name="enabled" value="true" />
                    <Button type="submit" size="lg">
                        <BookOpenIcon class="mr-2 size-4" />
                        Fetch Adult Empire listings
                    </Button>
                </form>

                {#if form?.message}
                    <p class="text-destructive text-xs">{form.message}</p>
                {/if}
            </div>
        {:else if !data.shelves.length}
            <div class="flex flex-col items-center gap-3 py-24 text-center">
                <p class="text-zinc-300">Reading the listings…</p>
                <p class="max-w-md font-mono text-xs text-zinc-400">
                    The brochure is switched on but the first sync has not landed yet. Covers appear
                    a shelf at a time; ratings and cast fill in afterwards. You can also change how
                    much it reads under Settings → Content → Brochure.
                </p>
            </div>
        {:else}
            <div class="flex flex-col gap-12 pb-20">
                <!--
                    Both rows are the shared components now, so this page and
                    Explore cannot drift apart -- they were the same ninety
                    lines of card markup twice, and any fix to one would have
                    been made twice and made twice differently.
                -->
                <StudioRow studios={data.studios} action="?/saveStudio" />

                {#each data.shelves as shelf (shelf.key)}
                    <ShelfRow {shelf} />
                {/each}
            </div>
        {/if}
    </div>
</PageShell>
