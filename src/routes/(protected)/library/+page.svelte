<script lang="ts">
    import { tick, onDestroy } from "svelte";
    import { page } from "$app/state";
    import type { PageProps } from "./$types";
    import { fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import * as Form from "$lib/components/ui/form/index.js";
    import { superForm } from "sveltekit-superforms";
    import { zod4Client } from "sveltekit-superforms/adapters";
    import { Input } from "$lib/components/ui/input/index.js";

    import ListItem from "$lib/components/list-item.svelte";
    import {
        itemsSearchSchema,
        typeOptions,
        stateOptions,
        groupOptions,
        GROUP_SORT,
        type GroupKey
    } from "$lib/schemas/items";
    import Trash from "@lucide/svelte/icons/trash";
    import Search from "@lucide/svelte/icons/search";
    import X from "@lucide/svelte/icons/x";
    import { Button } from "$lib/components/ui/button/index.js";
    import ListChecks from "@lucide/svelte/icons/list-checks";
    import * as Select from "$lib/components/ui/select/index.js";
    import { ItemStore } from "$lib/stores/library-items.svelte";
    import { reset_items, retry_items, remove_items, suggest } from "./library.remote";
    import { EMPTY_SUGGESTIONS, type Suggestions } from "$lib/suggestions";
    import * as Pagination from "$lib/components/ui/pagination/index.js";
    import Loading2Circle from "@lucide/svelte/icons/loader-2";
    import { toast } from "svelte-sonner";
    import { goto, invalidateAll } from "$app/navigation";
    import { resolve } from "$app/paths";
    import PageShell from "$lib/components/page-shell.svelte";
    import CollectionsShelf from "$lib/components/collections-shelf.svelte";
    import { streamed } from "$lib/streamed.svelte";
    import { Skeleton } from "$lib/components/ui/skeleton/index.js";
    import { cn } from "$lib/utils";

    let { data }: PageProps = $props();

    /*
        The grid and the shelf stream in separately. `library` carries the item
        page and its counts together, because they all come from one request.
    */
    const lib = streamed(() => data.library);
    const shelf = streamed(() => data.collections);

    const items = $derived(lib.value?.items ?? []);
    const totalItems = $derived(lib.value?.totalItems ?? 0);

    // svelte-ignore state_referenced_locally
    const form = superForm(data.itemsSearchForm, {
        validators: zod4Client(itemsSearchSchema),
        resetForm: false
    });

    const { form: formData } = form;

    const itemsStore = new ItemStore();

    /*
        Sort and group.

        Both live in the URL rather than in component state, so a grouped view
        is bookmarkable, survives a reload, and comes back the same way after
        an action re-runs the load.

        Choosing a group also sets the sort it implies. Grouping a page that is
        ordered by something else repeats the same heading down the page and
        splits every group across every page -- headings that describe
        nothing. See GROUP_SORT.
    */
    const sortLabels: Record<string, string> = {
        date_desc: "Recently added",
        date_asc: "Oldest added",
        title_asc: "Title A–Z",
        title_desc: "Title Z–A",
        rating_desc: "Highest rated",
        rating_asc: "Lowest rated",
        year_desc: "Newest release",
        year_asc: "Oldest release",
        studio_asc: "Studio A–Z",
        studio_desc: "Studio Z–A"
    };

    const groupLabels: Record<GroupKey, string> = {
        none: "No grouping",
        studio: "By studio",
        year: "By decade",
        state: "By state",
        rating: "By rating"
    };

    const activeSort = $derived(page.url.searchParams.get("sort") ?? "date_desc");
    const activeGroup = $derived((page.url.searchParams.get("group") ?? "none") as GroupKey);

    function navigate(mutate: (url: URL) => void) {
        const url = new URL(page.url);

        mutate(url);
        url.searchParams.set("page", "1");
        $formData.page = 1;

        goto(url.toString(), { keepFocus: true, noScroll: true, invalidateAll: true });
    }

    function setSort(value: string) {
        navigate((url) => url.searchParams.set("sort", value));
    }

    function setGroup(value: GroupKey) {
        navigate((url) => {
            if (value === "none") {
                url.searchParams.delete("group");
            } else {
                url.searchParams.set("group", value);
            }

            const implied = GROUP_SORT[value];

            if (implied) {
                url.searchParams.set("sort", implied);
            }
        });
    }

    /*
        Grouping is applied to the page that was loaded, not to the library.

        The alternative -- asking the backend to group -- means either loading
        the whole library to count the groups or paginating within each group,
        and the grid is already paginated. Pairing the group with a sort on the
        same key is what makes this correct in practice: members are
        contiguous, so a page shows whole groups apart from the two at its
        edges.
    */
    function bandOf(rating: number | null | undefined): string {
        // A stored 0 means "no ranking" -- TPDB writes it on every record --
        // so it groups with the unrated rather than as a score of zero.
        if (!rating) return "Not rated";
        if (rating >= 4.5) return "4.5 and up";
        if (rating >= 4) return "4 – 4.5";
        if (rating >= 3) return "3 – 4";

        return "Below 3";
    }

    function groupKeyFor(item: (typeof items)[number]): string {
        switch (activeGroup) {
            case "studio":
                return (item as any).site_name || "Unknown studio";
            case "year": {
                const year = Number(item.year);

                return Number.isFinite(year) && year > 0
                    ? `${Math.floor(year / 10) * 10}s`
                    : "Unknown year";
            }
            case "state":
                return item.state || "Unknown state";
            case "rating":
                return bandOf((item as any).rating);
            default:
                return "";
        }
    }

    const grouped = $derived.by(() => {
        if (activeGroup === "none") {
            return [] as { key: string; items: typeof items }[];
        }

        const out: { key: string; items: typeof items }[] = [];

        for (const item of items) {
            const key = groupKeyFor(item);
            const last = out[out.length - 1];

            // Appended in order rather than bucketed by key: the rows arrive
            // sorted on the group key, so consecutive runs are the groups.
            // Bucketing would silently merge two runs that a page boundary
            // separated, which would claim a group is complete when it is not.
            if (last && last.key === key) {
                last.items.push(item);
            } else {
                out.push({ key, items: [item] });
            }
        }

        return out;
    });

    /** Every item on this page, for the select-all control. */
    const pageIds = $derived(items.map((item) => item.riven_id).filter(Boolean) as number[]);
    const allSelected = $derived(pageIds.length > 0 && pageIds.every((id) => itemsStore.has(id)));

    function toggleAll() {
        if (allSelected) {
            pageIds.forEach((id) => itemsStore.has(id) && itemsStore.toggle(id));
        } else {
            pageIds.forEach((id) => !itemsStore.has(id) && itemsStore.toggle(id));
        }
    }

    let actionInProgress = $state(false);
    let formElement: HTMLFormElement;

    // Live Search Logic
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    function search() {
        const url = new URL(page.url);

        if ($formData.search) {
            url.searchParams.set("search", $formData.search);
        } else {
            url.searchParams.delete("search");
        }

        // Typing replaces a facet. Keeping both would show the intersection
        // of "titles by this performer" and "titles matching this text",
        // which is not what either control looks like it does.
        url.searchParams.delete("performer");
        url.searchParams.delete("site");

        url.searchParams.delete("type");
        if ($formData.type?.length) {
            $formData.type.forEach((t) => url.searchParams.append("type", t));
        }

        url.searchParams.delete("states");
        if ($formData.states?.length) {
            $formData.states.forEach((s) => url.searchParams.append("states", s));
        }

        // Reset to page 1 on search/filter change
        url.searchParams.set("page", "1");
        $formData.page = 1;

        goto(url.toString(), {
            keepFocus: true,
            noScroll: true,
            invalidateAll: true
        });
    }

    /*
        Suggestions.

        Two timers, deliberately at different delays: the dropdown is a cheap
        local query and should feel live (150ms), while the grid reload is a
        full page navigation and should not fire on every keystroke (300ms).

        `requestToken` is what keeps the list honest. Responses can land out
        of order -- a query for "ri" can answer after "riley" -- and without
        the token a slow early response would overwrite the current one with
        results for a prefix the user has already typed past.
    */
    let suggestions = $state<Suggestions>(EMPTY_SUGGESTIONS);
    let suggestOpen = $state(false);
    let activeIndex = $state(-1);
    let suggestTimer: ReturnType<typeof setTimeout> | undefined;
    let requestToken = 0;

    type Flat = { kind: "title" | "studio" | "performer"; value: string; count: number };

    const flatSuggestions = $derived<Flat[]>([
        ...suggestions.titles.map((s) => ({ kind: "title" as const, ...s })),
        ...suggestions.studios.map((s) => ({ kind: "studio" as const, ...s })),
        ...suggestions.performers.map((s) => ({ kind: "performer" as const, ...s }))
    ]);

    // The facet currently narrowing the grid, if any. Read from the URL
    // rather than held in state so a bookmarked or reloaded page shows it.
    const activePerformer = $derived(page.url.searchParams.get("performer"));
    const activeSite = $derived(page.url.searchParams.get("site"));

    async function loadSuggestions(term: string) {
        const token = ++requestToken;

        if (term.trim().length < 2) {
            suggestions = EMPTY_SUGGESTIONS;
            suggestOpen = false;
            return;
        }

        try {
            const result = await suggest({ q: term.trim() });

            if (token !== requestToken) return;

            suggestions = result;
            activeIndex = -1;
            suggestOpen =
                result.titles.length + result.studios.length + result.performers.length > 0;
        } catch {
            // The dropdown is an addition to a search box that works without
            // it; a failure here must not disturb what is being typed.
            if (token === requestToken) {
                suggestions = EMPTY_SUGGESTIONS;
                suggestOpen = false;
            }
        }
    }

    function handleSearchInput() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(search, 300);

        clearTimeout(suggestTimer);
        const term = $formData.search ?? "";
        suggestTimer = setTimeout(() => loadSuggestions(term), 150);
    }

    /** Filter by an exact studio or performer, replacing any text search. */
    function applyFacet(kind: Flat["kind"], value: string) {
        clearTimeout(debounceTimer);
        clearTimeout(suggestTimer);
        suggestOpen = false;
        activeIndex = -1;

        if (kind === "title") {
            // A title is not a facet: it is just the search everyone already
            // expected, with the term filled in.
            $formData.search = value;
            search();
            return;
        }

        const url = new URL(page.url);

        url.searchParams.delete("search");
        url.searchParams.delete("performer");
        url.searchParams.delete("site");
        url.searchParams.set(kind === "performer" ? "performer" : "site", value);
        url.searchParams.set("page", "1");

        $formData.search = "";
        $formData.page = 1;

        goto(url.toString(), { keepFocus: true, noScroll: true, invalidateAll: true });
    }

    function clearFacet() {
        const url = new URL(page.url);

        url.searchParams.delete("performer");
        url.searchParams.delete("site");
        url.searchParams.set("page", "1");
        $formData.page = 1;

        goto(url.toString(), { noScroll: true, invalidateAll: true });
    }

    function handleSearchKeydown(event: KeyboardEvent) {
        if (!suggestOpen || flatSuggestions.length === 0) return;

        if (event.key === "ArrowDown") {
            event.preventDefault();
            activeIndex = (activeIndex + 1) % flatSuggestions.length;
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            activeIndex = activeIndex <= 0 ? flatSuggestions.length - 1 : activeIndex - 1;
        } else if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            const picked = flatSuggestions[activeIndex];
            applyFacet(picked.kind, picked.value);
        } else if (event.key === "Escape") {
            suggestOpen = false;
            activeIndex = -1;
        }
    }

    onDestroy(() => {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
        clearTimeout(suggestTimer);
        suggestTimer = undefined;
    });
</script>

<PageShell class="bg-background relative flex min-h-screen flex-col overflow-x-hidden">
    <!-- Immersive Background -->
    <div class="pointer-events-none fixed inset-0 z-0">
        <div class="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black"></div>
        <div
            class="bg-primary/5 absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full blur-[120px]">
        </div>
        <div
            class="absolute right-[-5%] bottom-[-10%] h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-[100px]">
        </div>
    </div>

    <div class="relative z-10 mx-auto flex w-full max-w-[2400px] flex-col gap-8">
        <!-- Header Section -->
        <header class="flex flex-col justify-between gap-6 pt-32 md:flex-row md:items-end md:pt-0">
            <div class="space-y-2">
                <h1
                    class="font-serif text-5xl font-medium tracking-tight text-white/90 md:text-7xl">
                    Library
                </h1>
                <div class="flex items-center gap-2 text-zinc-400">
                    <span class="font-mono text-xs tracking-widest uppercase">Index</span>
                    <span class="h-px w-8 bg-zinc-800"></span>
                    <span class="text-primary font-mono text-sm"
                        >{totalItems.toLocaleString()} items</span>
                </div>
            </div>

            <!-- Compact Filter Bar -->
            <form
                method="GET"
                bind:this={formElement}
                class="flex flex-wrap items-center gap-2 rounded-2xl border border-white/5 bg-zinc-900/40 p-2 shadow-2xl backdrop-blur-md md:gap-3">
                <!-- Search Input -->
                <div class="group relative">
                    <Search
                        class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-white" />
                    <Form.Field {form} name="search" class="w-full space-y-0 md:w-64">
                        <Form.Control>
                            {#snippet children({ props })}
                                <Input
                                    {...props}
                                    bind:value={$formData.search}
                                    placeholder="Title, studio or performer..."
                                    oninput={handleSearchInput}
                                    onkeydown={handleSearchKeydown}
                                    onfocus={() => {
                                        if (flatSuggestions.length) suggestOpen = true;
                                    }}
                                    onblur={() => {
                                        // Deferred: a click on a suggestion
                                        // blurs the input before it lands, and
                                        // closing immediately would swallow it.
                                        setTimeout(() => (suggestOpen = false), 150);
                                    }}
                                    autocomplete="off"
                                    role="combobox"
                                    aria-expanded={suggestOpen}
                                    aria-autocomplete="list"
                                    class="h-10 rounded-xl border-transparent bg-transparent pl-9 transition-all placeholder:text-zinc-600 hover:bg-white/5 focus:bg-white/10" />
                            {/snippet}
                        </Form.Control>
                    </Form.Field>

                    {#if suggestOpen && flatSuggestions.length}
                        <div
                            role="listbox"
                            aria-label="Search suggestions"
                            transition:fly={{ y: -4, duration: 120, easing: cubicOut }}
                            class="absolute top-full left-0 z-50 mt-2 max-h-96 w-full min-w-[18rem] overflow-y-auto rounded-xl border border-white/10 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-md">
                            {#each [{ key: "titles", label: "Titles", items: suggestions.titles, kind: "title" as const }, { key: "studios", label: "Studios", items: suggestions.studios, kind: "studio" as const }, { key: "performers", label: "Performers", items: suggestions.performers, kind: "performer" as const }] as group (group.key)}
                                {#if group.items.length}
                                    <div
                                        class="px-3 pt-2 pb-1 font-mono text-[10px] tracking-widest text-zinc-500 uppercase">
                                        {group.label}
                                    </div>
                                    {#each group.items as suggestion (suggestion.value)}
                                        {@const index = flatSuggestions.findIndex(
                                            (entry) =>
                                                entry.kind === group.kind &&
                                                entry.value === suggestion.value
                                        )}
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={index === activeIndex}
                                            onmouseenter={() => (activeIndex = index)}
                                            onclick={() => applyFacet(group.kind, suggestion.value)}
                                            class={cn(
                                                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-zinc-200 transition-colors",
                                                index === activeIndex
                                                    ? "bg-white/10 text-white"
                                                    : "hover:bg-white/5"
                                            )}>
                                            <span class="truncate">{suggestion.value}</span>
                                            <span class="shrink-0 font-mono text-xs text-zinc-500"
                                                >{suggestion.count}</span>
                                        </button>
                                    {/each}
                                {/if}
                            {/each}
                        </div>
                    {/if}
                </div>

                {#if activePerformer || activeSite}
                    <button
                        type="button"
                        onclick={clearFacet}
                        class="text-primary flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm transition-colors hover:bg-white/10">
                        <span class="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">
                            {activePerformer ? "Cast" : "Studio"}
                        </span>
                        <span class="max-w-[12rem] truncate">{activePerformer ?? activeSite}</span>
                        <X class="h-3.5 w-3.5 text-zinc-400" />
                    </button>
                {/if}

                <div class="mx-1 hidden h-6 w-px bg-white/10 md:block"></div>

                <!-- Filters -->
                <Form.Field {form} name="type" class="min-w-[100px] space-y-0">
                    <Form.Control>
                        {#snippet children({ props })}
                            <Select.Root
                                type="multiple"
                                bind:value={$formData.type}
                                onValueChange={async () => {
                                    await tick();
                                    search();
                                }}
                                name={props.name}>
                                <Select.Trigger
                                    {...props}
                                    class="h-9 border-0 bg-transparent text-zinc-400 hover:bg-white/5 data-[state=open]:bg-white/10 data-[value]:text-white">
                                    {$formData.type?.length ? $formData.type.join(", ") : "Type"}
                                </Select.Trigger>
                                <Select.Content class="border-zinc-800 bg-zinc-900">
                                    {#each Object.keys(typeOptions) as option}
                                        <Select.Item value={option} label={option} />
                                    {/each}
                                </Select.Content>
                            </Select.Root>
                        {/snippet}
                    </Form.Control>
                </Form.Field>

                <Form.Field {form} name="states" class="min-w-[100px] space-y-0">
                    <Form.Control>
                        {#snippet children({ props })}
                            <Select.Root
                                type="multiple"
                                bind:value={$formData.states}
                                onValueChange={async () => {
                                    await tick();
                                    search();
                                }}
                                name={props.name}>
                                <Select.Trigger
                                    {...props}
                                    class="h-9 border-0 bg-transparent text-zinc-400 hover:bg-white/5 data-[state=open]:bg-white/10 data-[value]:text-white">
                                    {$formData.states?.length
                                        ? $formData.states.join(", ")
                                        : "State"}
                                </Select.Trigger>
                                <Select.Content class="border-zinc-800 bg-zinc-900">
                                    {#each Object.keys(stateOptions) as option}
                                        <Select.Item value={option} label={option} />
                                    {/each}
                                </Select.Content>
                            </Select.Root>
                        {/snippet}
                    </Form.Control>
                </Form.Field>
                <!-- Hidden inputs for pagination -->
                <input type="hidden" name="page" value={$formData.page} />
                <input type="hidden" name="limit" value={$formData.limit} />
            </form>
        </header>

        {#if shelf.pending}
            <div class="flex gap-4 overflow-hidden py-2">
                {#each Array.from({ length: 4 }, (_, i) => i) as tile (tile)}
                    <Skeleton class="h-24 w-40 shrink-0 rounded-xl" />
                {/each}
            </div>
        {:else}
            <CollectionsShelf collections={shelf.value ?? []} />
        {/if}

        <!--
            Sort, group and select-all.

            Sitting above the grid rather than inside the search header because
            they act on what the grid is showing, not on what it is filtered
            to. The count on the left is the honest one -- the whole result
            set, not this page.
        -->
        <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p class="font-mono text-xs text-zinc-400">
                {totalItems}
                {totalItems === 1 ? "title" : "titles"}
                {#if activeGroup !== "none"}
                    · grouped {groupLabels[activeGroup].toLowerCase()} within this page
                {/if}
            </p>

            <div class="flex flex-wrap items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    class="border-white/10 bg-black/20 text-xs"
                    disabled={!pageIds.length}
                    onclick={toggleAll}>
                    <ListChecks class="mr-2 size-4" />
                    {allSelected ? "Clear page" : "Select page"}
                </Button>

                <Select.Root type="single" value={activeSort} onValueChange={setSort}>
                    <Select.Trigger
                        class="h-9 w-[170px] border-white/10 bg-black/20 text-xs text-zinc-200">
                        {sortLabels[activeSort] ?? "Sort"}
                    </Select.Trigger>
                    <Select.Content class="border-zinc-800 bg-zinc-900">
                        {#each Object.entries(sortLabels) as [value, label] (value)}
                            <Select.Item {value} {label} />
                        {/each}
                    </Select.Content>
                </Select.Root>

                <Select.Root
                    type="single"
                    value={activeGroup}
                    onValueChange={(value) => setGroup(value as GroupKey)}>
                    <Select.Trigger
                        class="h-9 w-[150px] border-white/10 bg-black/20 text-xs text-zinc-200">
                        {groupLabels[activeGroup]}
                    </Select.Trigger>
                    <Select.Content class="border-zinc-800 bg-zinc-900">
                        {#each Object.keys(groupOptions) as value (value)}
                            <Select.Item {value} label={groupLabels[value as GroupKey]} />
                        {/each}
                    </Select.Content>
                </Select.Root>
            </div>
        </div>

        <!-- Content Grid -->
        {#if lib.pending}
            <!--
                Placeholder cards at the grid's own shape and count, so the
                page does not jump when the real ones replace them. Checked
                before the empty state below: "no items" is a claim the page
                cannot make until the query has answered.
            -->
            <div
                class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 md:gap-6 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
                {#each Array.from({ length: 14 }, (_, i) => i) as cell (cell)}
                    <Skeleton class="aspect-[2/3] w-full rounded-xl" />
                {/each}
            </div>
        {:else if totalItems > 0}
            {#snippet card(item: (typeof items)[number], i: number)}
                <div
                    class="animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards duration-700"
                    style="animation-delay: {i * 30}ms">
                    <ListItem
                        data={item}
                        indexer={item.indexer}
                        type={item.type}
                        isSelectable
                        selectStore={itemsStore}
                        class="w-full" />
                </div>
            {/snippet}

            {#if activeGroup === "none"}
                <div
                    class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 md:gap-6 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
                    {#each items as item, i (item.riven_id)}
                        {@render card(item, i)}
                    {/each}
                </div>
            {:else}
                <div class="flex flex-col gap-10">
                    {#each grouped as group (group.key)}
                        <section class="flex flex-col gap-4">
                            <div class="flex items-baseline gap-3">
                                <h2 class="text-lg font-semibold text-white/90">{group.key}</h2>
                                <span class="font-mono text-xs text-zinc-500">
                                    {group.items.length}
                                </span>
                            </div>
                            <div
                                class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 md:gap-6 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
                                {#each group.items as item, i (item.riven_id)}
                                    {@render card(item, i)}
                                {/each}
                            </div>
                        </section>
                    {/each}
                </div>
            {/if}

            <!-- Pagination -->
            <div class="flex justify-center pt-12 pb-24">
                <Pagination.Root
                    count={totalItems}
                    perPage={$formData.limit}
                    bind:page={$formData.page}>
                    {#snippet children({ pages, currentPage })}
                        <Pagination.Content>
                            <Pagination.Item>
                                <Pagination.PrevButton
                                    onclick={async () => {
                                        await tick();
                                        formElement.requestSubmit();
                                    }}
                                    class="border-white/10 hover:bg-white/10" />
                            </Pagination.Item>
                            {#each pages as page (page.key)}
                                {#if page.type === "ellipsis"}
                                    <Pagination.Item><Pagination.Ellipsis /></Pagination.Item>
                                {:else}
                                    <Pagination.Item>
                                        <Pagination.Link
                                            {page}
                                            isActive={currentPage === page.value}
                                            onclick={async () => {
                                                await tick();
                                                formElement.requestSubmit();
                                            }}
                                            class="data-[selected]:bg-primary data-[selected]:text-primary-foreground border-transparent hover:bg-white/10">
                                            {page.value}
                                        </Pagination.Link>
                                    </Pagination.Item>
                                {/if}
                            {/each}
                            <Pagination.Item>
                                <Pagination.NextButton
                                    onclick={async () => {
                                        await tick();
                                        formElement.requestSubmit();
                                    }}
                                    class="border-white/10 hover:bg-white/10" />
                            </Pagination.Item>
                        </Pagination.Content>
                    {/snippet}
                </Pagination.Root>
            </div>
        {:else}
            <div
                class="flex min-h-[50vh] flex-1 flex-col items-center justify-center space-y-4 text-center">
                <div
                    class="flex h-24 w-24 items-center justify-center rounded-full border border-white/5 bg-zinc-900/50">
                    <Search class="h-10 w-10 text-zinc-600" />
                </div>
                <div>
                    <h3 class="text-xl font-medium text-white">No items found</h3>
                    <p class="mx-auto mt-2 max-w-sm text-zinc-500">
                        We couldn't find anything matching your search. Try adjusting the filters or
                        search term.
                    </p>
                </div>
                <Button
                    variant="outline"
                    onclick={() => goto(resolve("/library"), { invalidateAll: true })}
                    class="border-white/10 hover:bg-white/5">
                    Clear all filters
                </Button>
            </div>
        {/if}

        <!-- Floating Selection Bar -->
        {#if itemsStore.count > 0}
            <div
                transition:fly={{ y: 100, duration: 400, easing: cubicOut }}
                class="fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-3xl border border-white/10 bg-zinc-900/80 p-2 pl-4 shadow-2xl backdrop-blur-xl">
                <div class="mr-4 flex items-center gap-3">
                    <div
                        class="bg-primary/20 text-primary flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold">
                        {itemsStore.count}
                    </div>
                    <span class="text-sm font-medium text-zinc-300">Selected</span>
                </div>

                <div class="mx-1 h-8 w-px bg-white/10"></div>

                <div class="flex items-center gap-1">
                    {#snippet actionButton(
                        label: string,
                        icon: any,
                        onClick: () => Promise<void>,
                        variant: "default" | "destructive" = "default"
                    )}
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={actionInProgress}
                            onclick={onClick}
                            class={cn(
                                "h-9 gap-2 rounded-xl px-3 transition-all",
                                variant === "destructive"
                                    ? "hover:bg-red-500/20 hover:text-red-400"
                                    : "hover:bg-white/10"
                            )}>
                            {#if actionInProgress}
                                <Loading2Circle class="h-3.5 w-3.5 animate-spin" />
                            {:else}
                                <icon.component class="h-3.5 w-3.5" />
                            {/if}
                            {label}
                        </Button>
                    {/snippet}

                    <!-- Actions -->
                    {@render actionButton("Reset", { component: ListChecks }, async () => {
                        actionInProgress = true;
                        try {
                            await reset_items({ ids: itemsStore.items.map((id) => id.toString()) });
                            toast.success(`Reset ${itemsStore.count} items`);
                            itemsStore.clear();
                            await invalidateAll();
                        } catch (e) {
                            if (e instanceof Error) toast.error(`Error: ${e.message}`);
                            else toast.error("An unknown error occurred");
                        } finally {
                            actionInProgress = false;
                        }
                    })}

                    {@render actionButton("Retry", { component: Loading2Circle }, async () => {
                        actionInProgress = true;
                        try {
                            await retry_items({ ids: itemsStore.items.map((id) => id.toString()) });
                            toast.success(`Retrying ${itemsStore.count} items`);
                            itemsStore.clear();
                            await invalidateAll();
                        } catch (e) {
                            if (e instanceof Error) toast.error(`Error: ${e.message}`);
                            else toast.error("An unknown error occurred");
                        } finally {
                            actionInProgress = false;
                        }
                    })}

                    {@render actionButton(
                        "Remove",
                        { component: Trash },
                        async () => {
                            actionInProgress = true;
                            try {
                                await remove_items({
                                    ids: itemsStore.items.map((id) => id.toString())
                                });
                                toast.success(`Removed ${itemsStore.count} items`);
                                itemsStore.clear();
                                await invalidateAll();
                            } catch (e) {
                                if (e instanceof Error) toast.error(`Error: ${e.message}`);
                                else toast.error("An unknown error occurred");
                            } finally {
                                actionInProgress = false;
                            }
                        },
                        "destructive"
                    )}

                    <div class="mx-1 h-8 w-px bg-white/10"></div>

                    <Button
                        variant="ghost"
                        size="icon"
                        class="h-9 w-9 rounded-xl hover:bg-white/10"
                        onclick={() => itemsStore.clear()}>
                        <X class="h-4 w-4" />
                    </Button>
                </div>
            </div>
        {/if}
    </div>
</PageShell>

<style>
    .fill-mode-backwards {
        animation-fill-mode: backwards;
    }
</style>
