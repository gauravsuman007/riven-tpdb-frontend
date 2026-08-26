<!--
    The studio directory: every studio Adult Empire lists, to pick from.

    A picker rather than a browsing surface, which is why it is a searchable
    grid of names and not a wall of covers. The studios chosen here become the
    Studios section on the brochure; opening one shows its ranked titles.

    Logos come from TPDB and are frequently missing -- Adult Empire's studio
    pages carry no artwork whatsoever -- so the name is the primary element and
    the logo is an enhancement, not the other way round.
-->
<script lang="ts">
    import type { PageProps } from "./$types";
    import { enhance } from "$app/forms";
    import { resolve } from "$app/paths";
    import { Button } from "$lib/components/ui/button/index.js";
    import PageShell from "$lib/components/page-shell.svelte";
    import BuildingIcon from "@lucide/svelte/icons/building-2";
    import CheckIcon from "@lucide/svelte/icons/check";
    import PlusIcon from "@lucide/svelte/icons/plus";
    import SearchIcon from "@lucide/svelte/icons/search";

    let { data, form }: PageProps = $props();

    let search = $state("");

    const savedCount = $derived(data.studios.filter((studio) => studio.saved).length);

    /*
        Filtered here rather than on the server. The whole directory arrives
        with the page, so typing narrows it instantly instead of putting a
        request and a spinner behind every keystroke.

        Matching ignores case and punctuation, because the directory writes
        studios every possible way -- "Devil's Film", "Devils Film" -- and a
        literal substring test makes half of them unfindable by the spelling
        a user would actually type.
    */
    const collapse = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

    const visible = $derived.by(() => {
        const needle = collapse(search);
        if (!needle) return data.studios;
        return data.studios.filter((studio) => collapse(studio.name).includes(needle));
    });
</script>

<svelte:head>
    <title>Studios · Riven</title>
</svelte:head>

<PageShell class="bg-background relative flex min-h-screen flex-col overflow-x-hidden">
    <div class="pointer-events-none fixed inset-0 z-0">
        <div class="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black"></div>
    </div>

    <div class="relative z-10 mx-auto flex w-full max-w-[2400px] flex-col gap-8">
        <header class="flex flex-col gap-2 pt-32 md:pt-0">
            <h1 class="font-serif text-5xl font-medium tracking-tight text-white/90 md:text-7xl">
                Studios
            </h1>
            <div class="flex flex-wrap items-center gap-2 text-zinc-300">
                <span class="font-mono text-xs tracking-widest uppercase">Adult Empire</span>
                <span class="h-px w-8 bg-zinc-700"></span>
                <span class="font-mono text-sm">
                    {data.studios.length} studios · {savedCount} saved
                </span>
            </div>
        </header>

        <div class="flex max-w-md items-center gap-2">
            <div class="relative flex-1">
                <SearchIcon
                    class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500"
                    aria-hidden="true" />
                <input
                    type="search"
                    bind:value={search}
                    placeholder="Search studios"
                    aria-label="Search studios"
                    class="w-full rounded-lg border border-white/15 bg-zinc-900/80 py-2 pr-3 pl-9 text-sm text-white placeholder:text-zinc-500 focus:border-white/40 focus:outline-none" />
            </div>
            {#if search}
                <span class="shrink-0 font-mono text-xs text-zinc-400">
                    {visible.length}
                </span>
            {/if}
        </div>

        {#if form?.message}
            <p class="font-mono text-xs text-zinc-400">{form.message}</p>
        {/if}

        {#if !visible.length}
            <div class="flex flex-col items-center gap-3 py-24 text-center">
                <BuildingIcon class="size-10 text-white/40" aria-hidden="true" />
                <p class="max-w-lg text-zinc-300">
                    {#if search}
                        No studio matches “{search}”.
                    {:else}
                        The studio directory has not been synced yet. It refreshes weekly overnight,
                        and reads one page per studio, so the first run takes a few minutes.
                    {/if}
                </p>
            </div>
        {:else}
            <ul class="grid grid-cols-2 gap-4 pb-20 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {#each visible as studio (studio.id)}
                    <li
                        class="flex flex-col gap-3 rounded-xl border border-white/15 bg-zinc-900/60 p-4 transition-colors hover:border-white/30">
                        <a
                            href={resolve(`/studios/${studio.id}`)}
                            class="flex flex-1 flex-col gap-3 focus-visible:outline-none">
                            <div class="flex h-16 items-center justify-center">
                                {#if studio.logo_path}
                                    <img
                                        src={studio.logo_path}
                                        alt={studio.name}
                                        loading="lazy"
                                        class="max-h-full max-w-full object-contain" />
                                {:else}
                                    <BuildingIcon
                                        class="size-8 text-white/30"
                                        aria-hidden="true" />
                                {/if}
                            </div>

                            <div class="space-y-1">
                                <p class="truncate text-sm font-medium text-white/90">
                                    {studio.name}
                                </p>
                                {#if studio.title_count}
                                    <p class="font-mono text-xs text-zinc-400">
                                        {studio.title_count.toLocaleString()} titles
                                    </p>
                                {/if}
                                {#if studio.description}
                                    <p class="line-clamp-2 text-xs text-zinc-500">
                                        {studio.description}
                                    </p>
                                {/if}
                            </div>
                        </a>

                        <form method="POST" action="?/save" use:enhance class="mt-auto">
                            <input type="hidden" name="studioId" value={studio.id} />
                            <input type="hidden" name="saved" value={String(!studio.saved)} />
                            <Button
                                type="submit"
                                variant={studio.saved ? "secondary" : "outline"}
                                size="sm"
                                class="w-full">
                                {#if studio.saved}
                                    <CheckIcon class="mr-2 size-4" aria-hidden="true" />
                                    Saved
                                {:else}
                                    <PlusIcon class="mr-2 size-4" aria-hidden="true" />
                                    Add
                                {/if}
                            </Button>
                        </form>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
</PageShell>
