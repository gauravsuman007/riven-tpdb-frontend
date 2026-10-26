<!--
    One studio: its ranked rows, read live from Adult Empire.

    The rows are the whole point of the page, and they are the two orders the
    storefront will actually rank by. There is deliberately no "Top Rated" row:
    Adult Empire carries a rating per title but offers no way to sort by it, and
    a row built by re-sorting forty-eight bestsellers would be a top-rated list
    of the bestsellers, which is not the same claim.

    Titles here are catalogue rows with no database entry yet. Clicking one
    creates it and hands off to the ordinary brochure detail page.
-->
<script lang="ts">
    import type { PageProps } from "./$types";
    import PosterImage from "$lib/components/media/poster-image.svelte";
    import { enhance } from "$app/forms";
    import { resolve } from "$app/paths";
    import { Button } from "$lib/components/ui/button/index.js";
    import PageShell from "$lib/components/page-shell.svelte";
    import BuildingIcon from "@lucide/svelte/icons/building-2";
    import CheckIcon from "@lucide/svelte/icons/check";
    import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
    import PlusIcon from "@lucide/svelte/icons/plus";

    let { data, form }: PageProps = $props();
</script>

<svelte:head>
    <title>{data.studio.name} · Riven</title>
</svelte:head>

<PageShell class="bg-background relative flex min-h-screen flex-col overflow-x-hidden">
    <div class="pointer-events-none fixed inset-0 z-0">
        <div class="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black"></div>
    </div>

    <div class="relative z-10 mx-auto flex w-full max-w-[2400px] flex-col gap-10">
        <header class="flex flex-col gap-4 pt-32 md:pt-0">
            <a
                href={resolve("/studios")}
                class="flex w-fit items-center gap-1.5 font-mono text-xs text-zinc-400 transition-colors hover:text-white">
                <ChevronLeftIcon class="size-4" aria-hidden="true" />
                All studios
            </a>

            <div class="flex flex-wrap items-end justify-between gap-6">
                <div class="flex items-center gap-5">
                    {#if data.studio.logo_path}
                        <img
                            src={data.studio.logo_path}
                            alt={data.studio.name}
                            class="h-16 max-w-[200px] object-contain" />
                    {:else}
                        <BuildingIcon class="size-12 text-white/30" aria-hidden="true" />
                    {/if}

                    <div class="space-y-1">
                        <h1
                            class="font-serif text-4xl font-medium tracking-tight text-white/90 md:text-6xl">
                            {data.studio.name}
                        </h1>
                        {#if data.studio.title_count}
                            <p class="font-mono text-sm text-zinc-400">
                                {data.studio.title_count.toLocaleString()} titles on Adult Empire
                            </p>
                        {/if}
                    </div>
                </div>

                <form method="POST" action="?/save" use:enhance>
                    <input type="hidden" name="studioId" value={data.studio.id} />
                    <input type="hidden" name="saved" value={String(!data.studio.saved)} />
                    <Button
                        type="submit"
                        variant={data.studio.saved ? "secondary" : "outline"}
                        size="sm">
                        {#if data.studio.saved}
                            <CheckIcon class="mr-2 size-4" aria-hidden="true" />
                            Saved
                        {:else}
                            <PlusIcon class="mr-2 size-4" aria-hidden="true" />
                            Save studio
                        {/if}
                    </Button>
                </form>
            </div>

            {#if data.studio.description}
                <p class="max-w-2xl text-sm text-zinc-300">{data.studio.description}</p>
            {/if}
        </header>

        {#if form?.message}
            <p class="font-mono text-xs text-zinc-400">{form.message}</p>
        {/if}

        <!--
            Awaited rather than loaded with the page: the rows are read live
            from the storefront and take a few seconds, and the studio above
            is ready immediately. The skeleton keeps the layout stable so
            nothing jumps when they arrive.
        -->
        <!--
            Each row awaits on its own: the storefront is read one request at a
            time, so the first row lands seconds before the second and there is
            no reason to hold it back. Headings are static and draw at once;
            the skeleton keeps the layout stable.
        -->
        <div class="flex flex-col gap-12 pb-20">
            {#each data.rows as row (row.key)}
                <section class="flex flex-col gap-4">
                    <div class="space-y-1">
                        <h2 class="font-serif text-2xl font-medium tracking-tight text-white/90">
                            {row.name}
                        </h2>
                        <p class="text-sm text-zinc-400">{row.description}</p>
                    </div>

                    {#await row.titles}
                        <ul class="flex gap-4 overflow-hidden pb-4">
                            {#each [0, 1, 2, 3, 4, 5] as i (i)}
                                <li class="w-[150px] shrink-0 md:w-[180px]">
                                    <div
                                        class="aspect-[3/4] animate-pulse rounded-xl border border-white/10 bg-zinc-900/60">
                                    </div>
                                </li>
                            {/each}
                        </ul>
                    {:then titles}
                        {#if !titles.length}
                            <p class="font-mono text-xs text-zinc-500">
                                Adult Empire returned nothing for this row just now. These rows are
                                read live, so reloading usually fixes it.
                            </p>
                        {:else}
                            <ul
                                class="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:thin]">
                                {#each titles as title (title.product_id)}
                                    <li class="w-[150px] shrink-0 snap-start md:w-[180px]">
                                        <!-- A form, not a link: opening a title creates its
                                             catalogue entry, a write a crawler must not trigger. -->
                                        <form method="POST" action="?/open" use:enhance>
                                            <input
                                                type="hidden"
                                                name="productId"
                                                value={title.product_id} />
                                            <button
                                                type="submit"
                                                class="group flex w-full flex-col gap-2 text-left focus-visible:outline-none">
                                                <div
                                                    class="relative aspect-[3/4] overflow-hidden rounded-xl border border-white/15 bg-zinc-900 transition-all group-hover:border-white/40 group-focus-visible:ring-2 group-focus-visible:ring-white">
                                                    {#if title.poster}
                                                        <PosterImage
                                                            src={title.poster}
                                                            alt={title.title}
                                                            class="transition-transform duration-500 group-hover:scale-105" />
                                                    {:else}
                                                        <div
                                                            class="flex h-full items-center justify-center p-3 text-center font-mono text-xs text-zinc-500">
                                                            {title.title}
                                                        </div>
                                                    {/if}

                                                    <span
                                                        class="absolute top-1.5 left-1.5 rounded-md bg-black/80 px-1.5 py-0.5 font-mono text-xs font-semibold text-white">
                                                        #{title.rank}
                                                    </span>
                                                </div>

                                                <p
                                                    class="truncate text-sm text-white/90 group-hover:text-white">
                                                    {title.title}
                                                </p>
                                            </button>
                                        </form>
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                    {:catch}
                        <p class="font-mono text-xs text-zinc-500">
                            Could not reach Adult Empire for this row.
                        </p>
                    {/await}
                </section>
            {/each}
        </div>
    </div>
</PageShell>
