<script lang="ts">
    import PageShell from "$lib/components/page-shell.svelte";
    import type { PageData } from "./$types";
    import { cn } from "$lib/utils";
    import * as Card from "$lib/components/ui/card/index.js";
    import * as Chart from "$lib/components/ui/chart/index.js";
    import ResponsiveChartContainer from "$lib/components/media/riven/responsive-chart-container.svelte";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { BarChart, PieChart, LineChart } from "layerchart";
    import { formatBytes, formatDate, getServiceDisplayName } from "$lib/helpers";
    import Heatmap from "$lib/components/heatmap.svelte";
    import { curveCatmullRom } from "d3-shape";
    import { fly } from "svelte/transition";
    import { describeState } from "$lib/utils/item-state";
    import * as dateUtils from "$lib/utils/date";
    import { cubicOut } from "svelte/easing";
    import { page } from "$app/state";
    import { goto, invalidateAll } from "$app/navigation";
    import { tick } from "svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Select from "$lib/components/ui/select/index.js";
    import * as Pagination from "$lib/components/ui/pagination/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { ItemStore } from "$lib/stores/library-items.svelte";
    import { stateOptions, sortOptions } from "$lib/schemas/items";
    import Pause from "@lucide/svelte/icons/pause";
    import Play from "@lucide/svelte/icons/play";
    import Trash from "@lucide/svelte/icons/trash";
    import X from "@lucide/svelte/icons/x";
    import Loading2Circle from "@lucide/svelte/icons/loader-2";
    import Search from "@lucide/svelte/icons/search";
    import {
        pause_downloads,
        unpause_downloads,
        cancel_downloads,
        pause_all_downloads,
        resume_all_downloads,
        cancel_all_downloads
    } from "./dashboard.remote";

    let { data }: { data: PageData } = $props();

    const downloadsStore = new ItemStore();
    let actionInProgress = $state(false);
    let queueActionInProgress = $state(false);
    let dlSearch = $state(page.url.searchParams.get("dl_search") ?? "");
    let dlStates = $state(page.url.searchParams.getAll("dl_state"));
    let dlSort = $state(page.url.searchParams.getAll("dl_sort"));
    let searchDebounce: ReturnType<typeof setTimeout> | undefined;

    function applyDownloadsQuery(resetPage: boolean) {
        const url = new URL(page.url);

        url.searchParams.delete("dl_state");
        dlStates.forEach((s) => url.searchParams.append("dl_state", s));

        url.searchParams.delete("dl_sort");
        dlSort.forEach((s) => url.searchParams.append("dl_sort", s));

        if (dlSearch) {
            url.searchParams.set("dl_search", dlSearch);
        } else {
            url.searchParams.delete("dl_search");
        }

        if (resetPage) url.searchParams.set("dl_page", "1");

        goto(url.toString(), { keepFocus: true, noScroll: true, invalidateAll: true });
    }

    function handleDlSearchInput() {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => applyDownloadsQuery(true), 300);
    }

    async function runDownloadAction(action: () => Promise<unknown>, successMsg: string) {
        actionInProgress = true;
        try {
            await action();
            toast.success(successMsg);
            downloadsStore.clear();
            await invalidateAll();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "An unknown error occurred");
        } finally {
            actionInProgress = false;
        }
    }

    async function runQueueAction(action: () => Promise<unknown>, successMsg: string) {
        queueActionInProgress = true;
        try {
            await action();
            toast.success(successMsg);
            await invalidateAll();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "An unknown error occurred");
        } finally {
            queueActionInProgress = false;
        }
    }

    function transformStatesToArray(states: Record<string, number> | undefined) {
        if (!states) return [];
        return Object.entries(states).reduce<{ state: string; value: number }[]>(
            (acc, [state, value]) => {
                if (value > 0) acc.push({ state, value });
                return acc;
            },
            []
        );
    }

    const transformedStates = $derived(transformStatesToArray(data.statistics?.states));

    const contentBreakdown = $derived.by(() => {
        if (!data.statistics) return [];
        return [
            { key: "Movies", value: data.statistics.total_movies, c: "#ef4444" },
            { key: "Shows", value: data.statistics.total_shows, c: "#14b8a6" },
            { key: "Seasons", value: data.statistics.total_seasons, c: "#60a5fa" },
            { key: "Episodes", value: data.statistics.total_episodes, c: "#f59e0b" }
        ];
    });

    const completionRate = $derived.by(() => {
        if (
            !data.statistics ||
            data.statistics.total_items === 0 ||
            data.statistics.states.Completed === undefined
        ) {
            return "0%";
        }
        return (
            ((data.statistics.states.Completed / data.statistics.total_items) * 100).toFixed(2) +
            "%"
        );
    });

    const activeDownloads = $derived(data.downloads?.active ?? []);
    const recentDownloads = $derived(data.downloads?.recent ?? []);

    /** "3h ago" style age, so a stalled item is obvious at a glance. */
    function since(iso: string | null | undefined): string {
        if (!iso) return "";

        const then = new Date(iso).getTime();
        if (Number.isNaN(then)) return "";

        const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
        if (minutes < 60) return `${minutes}m ago`;

        const hours = Math.round(minutes / 60);
        if (hours < 48) return `${hours}h ago`;

        return `${Math.round(hours / 24)}d ago`;
    }

    function detailsHref(entry: { tpdb_id?: string | null; type?: string }): string | null {
        if (!entry.tpdb_id) return null;
        return `/details/tpdb/${entry.type === "show" ? "tv" : "movie"}/${entry.tpdb_id}`;
    }

    const heatmapLegend = [
        { label: "No Activity", color: "var(--muted)" },
        { label: "Low", color: "var(--chart-4)" },
        { label: "Medium", color: "var(--chart-3)" },
        { label: "High", color: "var(--chart-2)" },
        { label: "Very High", color: "var(--chart-1)" }
    ];
</script>

<svelte:head>
    <title>Dashboard - Riven</title>
</svelte:head>

{#snippet KPICard({
    title,
    value,
    sub,
    tone = "default"
}: {
    title: string;
    value: string | undefined;
    sub?: string;
    tone?: "default" | "warning";
})}
    <Card.Root class={cn("", tone === "warning" && "border-amber-600/30")}>
        <Card.Header class="pb-2">
            <Card.Title class="text-sm font-medium text-neutral-300">{title}</Card.Title>
        </Card.Header>
        <Card.Content>
            <div
                class={cn(
                    "text-2xl font-semibold tracking-tight",
                    tone === "warning" ? "text-amber-300" : "text-neutral-50"
                )}>
                {value}
            </div>
            {#if sub}
                <p class="mt-1 text-sm text-neutral-400">{sub}</p>
            {/if}
        </Card.Content>
    </Card.Root>
{/snippet}

<PageShell>
    <h1 class="mb-8 text-3xl font-bold tracking-tight">Media Library Statistics</h1>

    <section class="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {@render KPICard({
            title: "Total Items",
            value: data.statistics?.total_items.toLocaleString(),
            sub: "All indexed items"
        })}
        {@render KPICard({
            title: "Completed",
            value: data.statistics?.states.Completed?.toLocaleString(),
            sub: "Fully processed"
        })}
        {@render KPICard({
            title: "Incomplete",
            value: data.statistics?.incomplete_items.toLocaleString(),
            sub: "Pending processing",
            tone: "warning"
        })}
        {@render KPICard({
            title: "Completion Rate",
            value: completionRate,
            sub: "Completed / Total"
        })}
    </section>

    <section class="mb-8 grid grid-cols-1 gap-4">
        <Card.Root>
            <Card.Header class="pb-2">
                <Card.Title class="text-sm font-medium text-neutral-300">Activity Chart</Card.Title>
            </Card.Header>
            <Card.Content>
                <Heatmap
                    data={data.statistics?.activity ?? {}}
                    colors={[
                        "var(--muted)",
                        "var(--chart-4)",
                        "var(--chart-3)",
                        "var(--chart-2)",
                        "var(--chart-1)"
                    ]} />

                <div class="mt-4 flex flex-wrap items-center justify-center gap-4">
                    {#each heatmapLegend as item (item.label)}
                        <div class="flex items-center gap-1.5">
                            <span
                                class="inline-block h-3 w-3 shrink-0 rounded-sm"
                                style="background-color: {item.color}"></span>
                            <span class="text-xs text-neutral-400">{item.label}</span>
                        </div>
                    {/each}
                </div>
            </Card.Content>
        </Card.Root>
    </section>

    <section class="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card.Root class="flex h-full flex-col">
            <Card.Header class="pb-2">
                <Card.Title class="text-sm font-medium text-neutral-300">Library States</Card.Title>
            </Card.Header>
            <Card.Content class="flex flex-1 flex-col">
                <ResponsiveChartContainer config={{}} class="min-h-[300px] w-full flex-1">
                    <BarChart
                        data={transformedStates}
                        x="state"
                        y="value"
                        c="state"
                        labels
                        padding={{ top: 16, bottom: 32, left: 32, right: 16 }}
                        props={{
                            bars: {
                                class: "fill-primary"
                            }
                        }}>
                        {#snippet tooltip()}
                            <Chart.Tooltip />
                        {/snippet}
                    </BarChart>
                </ResponsiveChartContainer>

                <div class="mt-auto pt-4">
                    {#each transformedStates as item (item.state)}
                        <div class="mt-4 flex items-center gap-2 first:mt-0">
                            <span class="text-sm text-neutral-300">{item.state}</span>
                            <span class="ml-auto font-mono text-sm text-neutral-50">
                                {item.value.toLocaleString()}
                            </span>
                        </div>
                    {/each}
                </div>
            </Card.Content>
        </Card.Root>

        <Card.Root class="flex h-full flex-col">
            <Card.Header class="pb-2">
                <Card.Title class="text-sm font-medium text-neutral-300"
                    >Content Breakdown</Card.Title>
            </Card.Header>
            <Card.Content class="flex flex-1 flex-col">
                <ResponsiveChartContainer config={{}} class="min-h-[300px] w-full flex-1">
                    <PieChart
                        data={contentBreakdown}
                        key="key"
                        value="value"
                        c="c"
                        innerRadius={-50}
                        cornerRadius={5}
                        padAngle={0.02}
                        padding={{ top: 16, bottom: 32, left: 32, right: 16 }}>
                        {#snippet tooltip()}
                            <Chart.Tooltip />
                        {/snippet}
                    </PieChart>
                </ResponsiveChartContainer>

                <div class="mt-auto pt-4">
                    {#each contentBreakdown as item (item.key)}
                        <div class="mt-4 flex items-center gap-2 first:mt-0">
                            <span
                                class="inline-block h-3 w-3 shrink-0 rounded-sm"
                                style="background-color: {item.c}"></span>
                            <span class="text-sm text-neutral-300">{item.key}</span>
                            <span class="ml-auto font-mono text-sm text-neutral-50">
                                {item.value.toLocaleString()}
                            </span>
                        </div>
                    {/each}
                </div>
            </Card.Content>
        </Card.Root>
    </section>

    <section class="mb-8 grid grid-cols-1">
        <Card.Root>
            <Card.Header class="pb-2">
                <Card.Title class="text-sm font-medium text-neutral-300">Release Year</Card.Title>
            </Card.Header>
            <Card.Content>
                <ResponsiveChartContainer
                    config={{}}
                    class="aspect-3/1 w-full md:aspect-4/1 lg:aspect-5/1 2xl:aspect-6/1">
                    <LineChart
                        data={data.statistics?.media_year_releases || []}
                        x="year"
                        series={[
                            {
                                key: "count",
                                color: "var(--chart-1)"
                            }
                        ]}
                        labels={{ offset: 10 }}
                        points
                        padding={{ top: 16, bottom: 32, left: 32, right: 16 }}
                        props={{ spline: { curve: curveCatmullRom } }}>
                        {#snippet tooltip()}
                            <Chart.Tooltip />
                        {/snippet}
                    </LineChart>
                </ResponsiveChartContainer>
            </Card.Content>
        </Card.Root>
    </section>

    <section class="mb-8 grid grid-cols-1">
        <Card.Root>
            <Card.Header>
                <Card.Title class="text-sm font-medium text-neutral-300">Service Status</Card.Title>
            </Card.Header>
            <Card.Content>
                <div class="flex flex-wrap gap-4">
                    {#if data.services && Object.keys(data.services).length > 0}
                        {#each Object.entries(data.services) as [serviceName, status] (serviceName)}
                            {#if status === true}
                                <Badge
                                    variant="default"
                                    class="rounded-xl bg-green-600/20 px-2 py-1 text-xs font-medium text-green-400">
                                    {serviceName}
                                </Badge>
                            {:else if status === false}
                                <Badge
                                    variant="destructive"
                                    class="rounded-xl px-2 py-1 text-xs font-medium">
                                    {serviceName}
                                </Badge>
                            {:else}
                                <Badge
                                    variant="secondary"
                                    class="rounded-xl px-2 py-1 text-xs font-medium">
                                    {serviceName}
                                </Badge>
                            {/if}
                        {/each}
                    {:else}
                        <p class="text-sm text-neutral-400">No service data available.</p>
                    {/if}
                </div>
            </Card.Content>
        </Card.Root>
    </section>

    <!--
        Download activity. There is no per-torrent progress bar to show: a
        debrid provider either has a release or it does not. What actually
        distinguishes "working" from "stuck" is the state reached, how long it
        has been sitting there, and how many releases were found -- so those
        are the columns.
    -->
    <section class="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card.Root class="flex h-full flex-col">
            <Card.Header class="pb-2">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                        <Card.Title class="text-sm font-medium text-neutral-300">
                            In Progress
                        </Card.Title>
                        <Badge variant="secondary" class="rounded-xl"
                            >{data.downloads?.total_active ?? activeDownloads.length}</Badge>
                    </div>

                    <div class="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={queueActionInProgress || activeDownloads.length === 0}
                            class="h-8 gap-1.5 rounded-lg px-2 text-xs hover:bg-white/10"
                            onclick={() =>
                                runQueueAction(
                                    () => pause_all_downloads(),
                                    "Paused all in-flight downloads"
                                )}>
                            <Pause class="h-3 w-3" /> Pause all
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={queueActionInProgress}
                            class="h-8 gap-1.5 rounded-lg px-2 text-xs hover:bg-white/10"
                            onclick={() =>
                                runQueueAction(
                                    () => resume_all_downloads(),
                                    "Resumed all paused downloads"
                                )}>
                            <Play class="h-3 w-3" /> Resume all
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={queueActionInProgress || activeDownloads.length === 0}
                            class="h-8 gap-1.5 rounded-lg px-2 text-xs hover:bg-red-500/20 hover:text-red-400"
                            onclick={() =>
                                runQueueAction(
                                    () => cancel_all_downloads(),
                                    "Cancelled all in-flight downloads"
                                )}>
                            <Trash class="h-3 w-3" /> Cancel all
                        </Button>
                    </div>
                </div>

                <!-- Filters: state, sort, search, page size -->
                <div class="mt-2 flex flex-wrap items-center gap-2">
                    <div class="group relative">
                        <Search
                            class="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                        <Input
                            bind:value={dlSearch}
                            oninput={handleDlSearchInput}
                            placeholder="Search title..."
                            class="h-8 w-40 rounded-lg border-transparent bg-white/5 pl-7 text-xs" />
                    </div>

                    <Select.Root
                        type="multiple"
                        bind:value={dlStates}
                        onValueChange={async () => {
                            await tick();
                            applyDownloadsQuery(true);
                        }}>
                        <Select.Trigger
                            class="h-8 w-28 rounded-lg border-0 bg-white/5 text-xs text-zinc-400">
                            {dlStates.length ? dlStates.join(", ") : "State"}
                        </Select.Trigger>
                        <Select.Content class="border-zinc-800 bg-zinc-900">
                            {#each Object.keys(stateOptions) as option}
                                <Select.Item value={option} label={option} />
                            {/each}
                        </Select.Content>
                    </Select.Root>

                    <Select.Root
                        type="multiple"
                        bind:value={dlSort}
                        onValueChange={async () => {
                            await tick();
                            applyDownloadsQuery(false);
                        }}>
                        <Select.Trigger
                            class="h-8 w-28 rounded-lg border-0 bg-white/5 text-xs text-zinc-400">
                            {dlSort.length ? dlSort.join(", ") : "Sort"}
                        </Select.Trigger>
                        <Select.Content class="border-zinc-800 bg-zinc-900">
                            {#each Object.keys(sortOptions) as option}
                                <Select.Item value={option} label={option} />
                            {/each}
                        </Select.Content>
                    </Select.Root>
                </div>
            </Card.Header>
            <Card.Content class="flex-1">
                {#if activeDownloads.length === 0}
                    <p class="text-muted-foreground py-8 text-center text-sm">
                        Nothing in the pipeline.
                    </p>
                {:else}
                    <ul class="divide-border divide-y">
                        {#each activeDownloads as entry (entry.riven_id)}
                            {@const status = describeState(entry.state)}
                            {@const href = detailsHref(entry)}
                            <li class="flex items-center justify-between gap-3 py-2.5">
                                <div class="flex min-w-0 items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={downloadsStore.has(entry.riven_id)}
                                        onchange={() => downloadsStore.toggle(entry.riven_id)}
                                        class="h-3.5 w-3.5 shrink-0 rounded border-zinc-700 bg-transparent" />
                                    <div class="min-w-0">
                                        {#if href}
                                            <a
                                                {href}
                                                class="truncate text-sm font-medium text-neutral-100 hover:underline">
                                                {entry.title}
                                            </a>
                                        {:else}
                                            <p class="truncate text-sm font-medium text-neutral-100">
                                                {entry.title}
                                            </p>
                                        {/if}
                                        <p class="text-muted-foreground mt-0.5 text-xs">
                                            {#if entry.requested_at}
                                                requested {since(entry.requested_at)}
                                            {/if}
                                            {#if entry.stream_count}
                                                · {entry.stream_count} release{entry.stream_count ===
                                                1
                                                    ? ""
                                                    : "s"} found
                                            {/if}
                                            {#if entry.scraped_times > 1}
                                                · {entry.scraped_times} scrape passes
                                            {/if}
                                            {#if entry.blacklisted_count}
                                                · {entry.blacklisted_count} rejected
                                            {/if}
                                        </p>
                                    </div>
                                </div>
                                <div class="flex shrink-0 items-center gap-1.5">
                                    <Badge
                                        variant="secondary"
                                        class={cn(
                                            "rounded-xl",
                                            status.variant === "error" &&
                                                "bg-red-600/25 text-red-300",
                                            status.variant === "success" &&
                                                "bg-green-600/25 text-green-300"
                                        )}>{status.label}</Badge>
                                    {#if entry.state === "Paused"}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={actionInProgress}
                                            class="h-7 w-7 rounded-lg hover:bg-white/10"
                                            title="Resume"
                                            onclick={() =>
                                                runDownloadAction(
                                                    () =>
                                                        unpause_downloads({
                                                            ids: [String(entry.riven_id)]
                                                        }),
                                                    `Resumed ${entry.title}`
                                                )}>
                                            <Play class="h-3.5 w-3.5" />
                                        </Button>
                                    {:else}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={actionInProgress}
                                            class="h-7 w-7 rounded-lg hover:bg-white/10"
                                            title="Pause"
                                            onclick={() =>
                                                runDownloadAction(
                                                    () =>
                                                        pause_downloads({
                                                            ids: [String(entry.riven_id)]
                                                        }),
                                                    `Paused ${entry.title}`
                                                )}>
                                            <Pause class="h-3.5 w-3.5" />
                                        </Button>
                                    {/if}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={actionInProgress}
                                        class="h-7 w-7 rounded-lg hover:bg-red-500/20 hover:text-red-400"
                                        title="Cancel"
                                        onclick={() =>
                                            runDownloadAction(
                                                () =>
                                                    cancel_downloads({
                                                        ids: [String(entry.riven_id)]
                                                    }),
                                                `Cancelled ${entry.title}`
                                            )}>
                                        <Trash class="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </li>
                        {/each}
                    </ul>

                    {#if (data.downloads?.total_pages ?? 1) > 1}
                        <div class="flex justify-center pt-4">
                            <Pagination.Root
                                count={data.downloads?.total_active ?? 0}
                                perPage={data.downloads?.limit ?? 15}
                                page={data.downloads?.page ?? 1}
                                onPageChange={(p) => {
                                    const url = new URL(page.url);
                                    url.searchParams.set("dl_page", String(p));
                                    goto(url.toString(), {
                                        keepFocus: true,
                                        noScroll: true,
                                        invalidateAll: true
                                    });
                                }}>
                                {#snippet children({ pages, currentPage })}
                                    <Pagination.Content>
                                        <Pagination.Item>
                                            <Pagination.PrevButton
                                                class="border-white/10 hover:bg-white/10" />
                                        </Pagination.Item>
                                        {#each pages as p (p.key)}
                                            {#if p.type === "ellipsis"}
                                                <Pagination.Item
                                                    ><Pagination.Ellipsis /></Pagination.Item>
                                            {:else}
                                                <Pagination.Item>
                                                    <Pagination.Link
                                                        page={p}
                                                        isActive={currentPage === p.value}
                                                        class="data-[selected]:bg-primary data-[selected]:text-primary-foreground border-transparent hover:bg-white/10">
                                                        {p.value}
                                                    </Pagination.Link>
                                                </Pagination.Item>
                                            {/if}
                                        {/each}
                                        <Pagination.Item>
                                            <Pagination.NextButton
                                                class="border-white/10 hover:bg-white/10" />
                                        </Pagination.Item>
                                    </Pagination.Content>
                                {/snippet}
                            </Pagination.Root>
                        </div>
                    {/if}
                {/if}
            </Card.Content>
        </Card.Root>

        <Card.Root class="flex h-full flex-col">
            <Card.Header class="pb-2">
                <Card.Title class="text-sm font-medium text-neutral-300">
                    Recently Downloaded
                </Card.Title>
            </Card.Header>
            <Card.Content class="flex-1">
                {#if recentDownloads.length === 0}
                    <p class="text-muted-foreground py-8 text-center text-sm">
                        Nothing downloaded yet.
                    </p>
                {:else}
                    <ul class="divide-border divide-y">
                        {#each recentDownloads as entry (entry.riven_id)}
                            {@const href = detailsHref(entry)}
                            <li class="flex items-center justify-between gap-3 py-2.5">
                                <div class="min-w-0">
                                    {#if href}
                                        <a
                                            {href}
                                            class="truncate text-sm font-medium text-neutral-100 hover:underline">
                                            {entry.title}
                                        </a>
                                    {:else}
                                        <p class="truncate text-sm font-medium text-neutral-100">
                                            {entry.title}
                                        </p>
                                    {/if}
                                    <p class="text-muted-foreground mt-0.5 text-xs">
                                        {since(entry.completed_at)}
                                        {#if entry.file_size}
                                            · {formatBytes(entry.file_size)}
                                        {/if}
                                    </p>
                                </div>
                                <Badge
                                    variant="secondary"
                                    class="shrink-0 rounded-xl bg-green-600/25 text-green-300">
                                    Available
                                </Badge>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </Card.Content>
        </Card.Root>
    </section>

    <section class="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {#each data.downloaderInfo?.services || [] as downloader (downloader.service)}
            <Card.Root class="bg-card border bg-linear-to-br">
                <Card.Header class="pb-3">
                    <div class="flex items-center justify-between">
                        <Card.Title class="text-lg font-semibold text-neutral-50">
                            {getServiceDisplayName(downloader.service)}
                        </Card.Title>
                        <Badge
                            variant={downloader.premium_status === "premium"
                                ? "default"
                                : "secondary"}
                            class={downloader.premium_status === "premium"
                                ? "rounded-xl bg-amber-600/30 text-amber-300 hover:bg-amber-600/40"
                                : "rounded-xl"}>
                            {downloader.premium_status === "premium" ? "Premium" : "Free"}
                        </Badge>
                    </div>
                </Card.Header>
                <Card.Content class="space-y-3">
                    {#if downloader.username || downloader.email}
                        <div>
                            <p class="text-xs font-medium text-neutral-400">Account</p>
                            <p class="mt-0.5 text-sm font-medium text-neutral-100">
                                {downloader.username || downloader.email}
                            </p>
                        </div>
                    {/if}

                    {#if downloader.premium_status === "premium" && (downloader.premium_expires_at || downloader.premium_days_left !== null)}
                        <div class="grid grid-cols-2 gap-3">
                            {#if downloader.premium_expires_at}
                                <div>
                                    <p class="text-xs font-medium text-neutral-400">Expires</p>
                                    <p class="mt-0.5 text-sm font-medium text-neutral-100">
                                        {formatDate(downloader.premium_expires_at)}
                                    </p>
                                </div>
                            {/if}
                            {#if downloader.premium_days_left !== null && downloader.premium_days_left !== undefined}
                                <div>
                                    <p class="text-xs font-medium text-neutral-400">Days Left</p>
                                    <p
                                        class={cn(
                                            "mt-0.5 text-sm font-semibold",
                                            downloader.premium_days_left < 7
                                                ? "text-red-400"
                                                : downloader.premium_days_left < 30
                                                  ? "text-amber-300"
                                                  : "text-green-400"
                                        )}>
                                        {downloader.premium_days_left}
                                    </p>
                                </div>
                            {/if}
                        </div>
                    {/if}

                    <div class="grid grid-cols-2 gap-3">
                        {#if downloader.points !== null && downloader.points !== undefined}
                            <div>
                                <p class="text-xs font-medium text-neutral-400">Points</p>
                                <p class="mt-0.5 text-sm font-medium text-neutral-100">
                                    {downloader.points.toLocaleString()}
                                </p>
                            </div>
                        {/if}
                        {#if downloader.total_downloaded_bytes !== null && downloader.total_downloaded_bytes !== undefined}
                            <div>
                                <p class="text-xs font-medium text-neutral-400">Downloaded</p>
                                <p class="mt-0.5 text-sm font-medium text-neutral-100">
                                    {formatBytes(downloader.total_downloaded_bytes)}
                                </p>
                            </div>
                        {/if}
                    </div>

                    {#if downloader.cooldown_until}
                        <div class="rounded-md bg-amber-600/20 p-2">
                            <p class="text-xs font-medium text-amber-300">
                                Cooldown until {formatDate(downloader.cooldown_until)}
                            </p>
                        </div>
                    {/if}
                </Card.Content>
            </Card.Root>
        {/each}
    </section>

    <!-- Floating Selection Bar: bulk actions for selected in-progress downloads -->
    {#if downloadsStore.count > 0}
        <div
            transition:fly={{ y: 100, duration: 400, easing: cubicOut }}
            class="fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-3xl border border-white/10 bg-zinc-900/80 p-2 pl-4 shadow-2xl backdrop-blur-xl">
            <div class="mr-4 flex items-center gap-3">
                <div
                    class="bg-primary/20 text-primary flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold">
                    {downloadsStore.count}
                </div>
                <span class="text-sm font-medium text-zinc-300">Selected</span>
            </div>

            <div class="mx-1 h-8 w-px bg-white/10"></div>

            <div class="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={actionInProgress}
                    class="h-9 gap-2 rounded-xl px-3 hover:bg-white/10"
                    onclick={() =>
                        runDownloadAction(
                            () =>
                                pause_downloads({
                                    ids: downloadsStore.items.map((id) => id.toString())
                                }),
                            `Paused ${downloadsStore.count} items`
                        )}>
                    {#if actionInProgress}
                        <Loading2Circle class="h-3.5 w-3.5 animate-spin" />
                    {:else}
                        <Pause class="h-3.5 w-3.5" />
                    {/if}
                    Pause
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    disabled={actionInProgress}
                    class="h-9 gap-2 rounded-xl px-3 hover:bg-white/10"
                    onclick={() =>
                        runDownloadAction(
                            () =>
                                unpause_downloads({
                                    ids: downloadsStore.items.map((id) => id.toString())
                                }),
                            `Resumed ${downloadsStore.count} items`
                        )}>
                    {#if actionInProgress}
                        <Loading2Circle class="h-3.5 w-3.5 animate-spin" />
                    {:else}
                        <Play class="h-3.5 w-3.5" />
                    {/if}
                    Resume
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    disabled={actionInProgress}
                    class="h-9 gap-2 rounded-xl px-3 hover:bg-red-500/20 hover:text-red-400"
                    onclick={() =>
                        runDownloadAction(
                            () =>
                                cancel_downloads({
                                    ids: downloadsStore.items.map((id) => id.toString())
                                }),
                            `Cancelled ${downloadsStore.count} items`
                        )}>
                    {#if actionInProgress}
                        <Loading2Circle class="h-3.5 w-3.5 animate-spin" />
                    {:else}
                        <Trash class="h-3.5 w-3.5" />
                    {/if}
                    Cancel
                </Button>

                <div class="mx-1 h-8 w-px bg-white/10"></div>

                <Button
                    variant="ghost"
                    size="sm"
                    class="h-9 gap-2 rounded-xl px-3 hover:bg-white/10"
                    onclick={() =>
                        activeDownloads.forEach((entry) => {
                            if (!downloadsStore.has(entry.riven_id))
                                downloadsStore.toggle(entry.riven_id);
                        })}>
                    Select all on page
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    class="h-9 w-9 rounded-xl hover:bg-white/10"
                    onclick={() => downloadsStore.clear()}>
                    <X class="h-4 w-4" />
                </Button>
            </div>
        </div>
    {/if}
</PageShell>
