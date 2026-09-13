<!--
    The studios the user follows, as a row, with the marking done in place.

    TWO THINGS THAT USED TO NEED TWO PAGES. The row only ever showed studios
    already saved, and saving was somewhere else entirely -- the directory at
    /studios -- so an empty row could only say "go over there and come back".
    The star on each card does it from here, and when nothing is followed yet
    the row offers the largest catalogues as a starting point rather than an
    empty rectangle. "Browse all" still goes to the directory, because a
    hundred-odd studios is a picker's job and not a row's.

    A studio card is landscape and a title card is portrait, on purpose: the
    two kinds of row sit directly above one another on Explore and a reader
    should be able to tell at a glance which one they are scrolling.

    Clicking one opens that studio's own page, which is where its bestsellers
    and trending titles are read live from the storefront.
-->
<script lang="ts">
    import { enhance } from "$app/forms";
    import { resolve } from "$app/paths";
    import type { Studio } from "$lib/studios";
    import { Button } from "$lib/components/ui/button/index.js";
    import BuildingIcon from "@lucide/svelte/icons/building-2";
    import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
    import StarIcon from "@lucide/svelte/icons/star";

    let {
        studios,
        suggestions = [],
        action = "?/saveStudio"
    }: {
        /** Saved studios, which is what the row is for. */
        studios: Studio[];
        /** Shown only when nothing is saved yet, so the row is usable cold. */
        suggestions?: Studio[];
        /** The form action that toggles one, on whichever page this sits. */
        action?: string;
    } = $props();

    const shown = $derived(studios.length ? studios : suggestions);
    const prompting = $derived(!studios.length && suggestions.length > 0);
</script>

<section class="flex flex-col gap-4">
    <div class="flex items-end justify-between gap-4">
        <div class="space-y-1">
            <h2 class="font-serif text-2xl font-medium tracking-tight text-white/90">Studios</h2>
            <p class="text-sm text-zinc-400">
                {#if prompting}
                    Star a studio to keep it here. Opening one shows its bestsellers and what is
                    trending on it now.
                {:else}
                    Top sellers and trending titles, per studio.
                {/if}
            </p>
        </div>
        <a
            href={resolve("/studios")}
            class="flex shrink-0 items-center gap-1.5 font-mono text-xs text-zinc-300 transition-colors hover:text-white">
            Browse all
            <ChevronRightIcon class="size-4" aria-hidden="true" />
        </a>
    </div>

    {#if shown.length}
        <ul class="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:thin]">
            {#each shown as studio (studio.id)}
                <li class="relative w-[180px] shrink-0 snap-start md:w-[220px]">
                    <a
                        href={resolve(`/studios/${studio.id}`)}
                        class="group flex flex-col gap-2 focus-visible:outline-none">
                        <div
                            class="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-zinc-900 p-3 transition-all group-hover:border-white/40 group-focus-visible:ring-2 group-focus-visible:ring-white">
                            <!--
                                Adult Empire has no studio artwork at all; the
                                logo is TPDB's and is missing for the studios
                                it does not carry, so the name is a real
                                fallback rather than a placeholder.
                            -->
                            {#if studio.logo_path}
                                <img
                                    src={studio.logo_path}
                                    alt={studio.name}
                                    loading="lazy"
                                    class="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105" />
                            {:else}
                                <span class="text-center font-serif text-sm text-white/80">
                                    {studio.name}
                                </span>
                            {/if}
                        </div>

                        <div class="space-y-0.5 pr-9">
                            <p class="truncate text-sm text-white/90 group-hover:text-white">
                                {studio.name}
                            </p>
                            {#if studio.title_count}
                                <p class="truncate font-mono text-xs text-zinc-400">
                                    {studio.title_count.toLocaleString()} titles
                                </p>
                            {/if}
                        </div>
                    </a>

                    <!--
                        OUTSIDE the anchor, not inside it: a <form> nested in
                        an <a> is invalid markup, and a button that is a
                        descendant of a link takes the link's navigation with
                        it however carefully the click is stopped.
                    -->
                    <form
                        method="POST"
                        {action}
                        class="absolute right-1 bottom-1"
                        use:enhance>
                        <input type="hidden" name="studioId" value={studio.id} />
                        <input type="hidden" name="saved" value={String(!studio.saved)} />
                        <button
                            type="submit"
                            class="rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                            aria-pressed={studio.saved}
                            title={studio.saved ? `Unfollow ${studio.name}` : `Follow ${studio.name}`}>
                            <StarIcon
                                class="size-4 {studio.saved
                                    ? 'fill-amber-400 text-amber-400'
                                    : ''}"
                                aria-hidden="true" />
                            <span class="sr-only">
                                {studio.saved ? "Unfollow" : "Follow"}
                                {studio.name}
                            </span>
                        </button>
                    </form>
                </li>
            {/each}
        </ul>
    {:else}
        <div
            class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/20 py-12 text-center">
            <BuildingIcon class="size-8 text-white/40" aria-hidden="true" />
            <p class="max-w-md text-sm text-zinc-300">
                No studios yet. The directory is read from Adult Empire's listings, so it fills in
                once the brochure has synced at least once.
            </p>
            <Button href={resolve("/studios")} variant="secondary" size="sm">
                <BuildingIcon class="mr-2 size-4" aria-hidden="true" />
                Browse studios
            </Button>
        </div>
    {/if}
</section>
