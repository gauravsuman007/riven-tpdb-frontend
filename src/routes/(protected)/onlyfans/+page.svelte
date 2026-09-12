<script lang="ts">
    import type { Action } from "svelte/action";
    import { resolve } from "$app/paths";
    import PageShell from "$lib/components/page-shell.svelte";
    import PosterImage from "$lib/components/media/poster-image.svelte";
    import { Skeleton } from "$lib/components/ui/skeleton/index.js";
    import SearchIcon from "@lucide/svelte/icons/search";
    import { browseAccounts, type OnlyFansAccount } from "$lib/onlyfans";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    const PAGE_SIZE = 60;

    /*
        The server's first page is read through `data`; anything the browser
        fetches afterwards -- a search, or the next scroll page -- replaces it
        here. Keeping the two apart rather than seeding one `$state` from the
        prop means `data` is only ever read inside a derived, so navigating
        back to this page shows that navigation's rows rather than the ones
        left over from the previous visit.
    */
    let fetched = $state<{ items: OnlyFansAccount[]; total: number } | null>(null);

    const accounts = $derived(fetched?.items ?? data.page?.items ?? []);
    const total = $derived(fetched?.total ?? data.page?.total ?? 0);

    let search = $state("");
    let loading = $state(false);
    let failed = $state(false);

    /*
        The query the rows on screen belong to. Compared against `search` when
        a response lands, so a slow reply for "soph" cannot overwrite results
        the user is already seeing for "sophie" -- the classic out-of-order
        search bug, which looks like the filter randomly reverting.
    */
    let appliedQuery = $state("");
    let debounce: ReturnType<typeof setTimeout> | undefined;

    const hasMore = $derived(accounts.length < total);

    async function runSearch(query: string) {
        loading = true;
        const result = await browseAccounts({ search: query, limit: PAGE_SIZE, offset: 0 });

        // Dropped rather than applied if the box has moved on since.
        if (query !== search) {
            loading = false;
            return;
        }

        if (result) {
            fetched = { items: result.items, total: result.total };
            appliedQuery = query;
            failed = false;
        } else {
            failed = true;
        }
        loading = false;
    }

    function onInput() {
        clearTimeout(debounce);
        // Long enough that typing a name is one request rather than eight,
        // short enough to feel live.
        debounce = setTimeout(() => runSearch(search), 250);
    }

    async function loadMore() {
        if (loading || !hasMore) return;
        loading = true;

        const offset = accounts.length;
        const result = await browseAccounts({
            search: appliedQuery,
            limit: PAGE_SIZE,
            offset
        });

        // Same guard as above, plus one for the list having been replaced by a
        // search while this page was in flight: appending then would splice
        // one query's results into another's.
        if (appliedQuery !== search || accounts.length !== offset) {
            loading = false;
            return;
        }

        if (result) {
            // Deduplicated on handle: a sync running while someone scrolls can
            // shift rows between pages, which would otherwise show a duplicate
            // card and break the keyed each.
            const seen = new Set(accounts.map((a) => a.handle));
            fetched = {
                items: [...accounts, ...result.items.filter((a) => !seen.has(a.handle))],
                total: result.total
            };
            failed = false;
        } else {
            failed = true;
        }
        loading = false;
    }

    const infiniteScroll: Action<HTMLDivElement> = (node) => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) loadMore();
            },
            { threshold: 0.1 }
        );
        observer.observe(node);
        return {
            destroy() {
                observer.disconnect();
                clearTimeout(debounce);
            }
        };
    };

    /** Initials, for an account no site has a picture for. */
    function initials(name: string): string {
        return name
            .split(/[\s_-]+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? "")
            .join("");
    }
</script>

<svelte:head>
    <title>OnlyFans — Riven</title>
</svelte:head>

<PageShell class="bg-background relative flex flex-col overflow-x-hidden !pt-6">
    <div class="pointer-events-none fixed inset-0 z-0">
        <div class="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black"></div>
        <div
            class="bg-primary/5 absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full blur-[120px]">
        </div>
    </div>

    <div class="relative z-10 mx-auto flex w-full max-w-[2400px] flex-col gap-8 px-4 md:px-16">
        <header class="flex flex-col gap-2">
            <h1 class="font-serif text-5xl font-medium tracking-tight text-white/90 md:text-7xl">
                OnlyFans
            </h1>
            <p class="max-w-2xl text-sm text-zinc-400">
                Performers indexed across the archive sites. Open one to load its videos and
                galleries from each site that carries it.
            </p>
        </header>

        <div class="flex flex-wrap items-center gap-3">
            <div class="relative w-full max-w-md">
                <SearchIcon
                    class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500"
                    aria-hidden="true" />
                <input
                    type="search"
                    bind:value={search}
                    oninput={onInput}
                    placeholder="Search performers…"
                    aria-label="Search performers"
                    class="w-full rounded-lg border border-white/15 bg-zinc-900/80 py-2 pr-3 pl-9 text-sm text-white/90 placeholder:text-zinc-500 focus:border-white/30 focus:outline-none" />
            </div>
            <span class="font-mono text-xs text-zinc-400">
                {accounts.length} of {total}
            </span>
        </div>

        {#if failed}
            <p class="text-sm text-red-400">
                Could not reach the index. The rows below may be out of date.
            </p>
        {/if}

        {#if accounts.length === 0 && !loading}
            <p class="text-sm text-zinc-400">
                {#if appliedQuery}
                    No performer matches “{appliedQuery}”.
                {:else}
                    The index is empty. Enable it under Settings → OnlyFans and run a sync.
                {/if}
            </p>
        {/if}

        <div
            class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
            {#each accounts as account (account.handle)}
                <a
                    href={resolve(`/onlyfans/${account.handle}`)}
                    class="group flex flex-col gap-2"
                    title={account.display_name}>
                    <div
                        class="relative aspect-square overflow-hidden rounded-full border border-white/15 bg-zinc-900 transition group-hover:border-white/40">
                        {#if account.avatar_url}
                            <PosterImage src={account.avatar_url} alt={account.display_name} />
                        {:else}
                            <!-- Three of the five sites render "no image" for every
							     model, so this is the normal case rather than an
							     error state. -->
                            <div
                                class="flex h-full w-full items-center justify-center font-serif text-xl text-zinc-500">
                                {initials(account.display_name)}
                            </div>
                        {/if}
                    </div>
                    <div class="min-w-0 text-center">
                        <p class="truncate text-xs font-medium text-white/90">
                            {account.display_name}
                        </p>
                        <p class="font-mono text-[10px] text-zinc-500">
                            {account.source_count}
                            {account.source_count === 1 ? "site" : "sites"}
                        </p>
                    </div>
                </a>
            {/each}

            {#if loading}
                {#each [...Array(10).keys()] as index (index)}
                    <div class="flex flex-col gap-2">
                        <Skeleton class="aspect-square rounded-full" />
                        <Skeleton class="h-3 w-full" />
                    </div>
                {/each}
            {/if}
        </div>

        <!-- The scroll sentinel. Rendered only while there is more to fetch, so
		     it cannot sit in view firing loadMore() against an exhausted list. -->
        {#if hasMore}
            <div use:infiniteScroll class="h-10"></div>
        {/if}
    </div>
</PageShell>
