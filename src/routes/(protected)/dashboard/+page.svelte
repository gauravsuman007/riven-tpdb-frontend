<script lang="ts">
    import PageShell from "$lib/components/page-shell.svelte";
    import type { PageData } from "./$types";
    import { gqlClient } from "$lib/graphql-client";
    import { cn } from "$lib/utils";
    import * as Card from "$lib/components/ui/card/index.js";
    import * as Chart from "$lib/components/ui/chart/index.js";
    import ResponsiveChartContainer from "$lib/components/media/riven/responsive-chart-container.svelte";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { BarChart, PieChart, LineChart } from "layerchart";
    import { formatBytes, formatDate, getServiceDisplayName } from "$lib/helpers";
    import Heatmap from "$lib/components/heatmap.svelte";
    import { curveCatmullRom } from "d3-shape";
    import { onMount } from "svelte";

    let { data }: { data: PageData } = $props();
    type ActivePlaybackSession = {
        server: string;
        userName: string | null;
        parentTitle: string | null;
        itemTitle: string;
        itemType: string | null;
        seasonNumber: number | null;
        episodeNumber: number | null;
        playbackState: string;
        playbackMethod: string;
        positionSeconds: number | null;
        durationSeconds: number | null;
        deviceName: string | null;
        clientName: string | null;
        imageUrl: string | null;
    };

    let activePlaybackSessions = $state<ActivePlaybackSession[]>([]);
    const serviceStatuses = $derived(
        (data as PageData & { services?: Record<string, boolean | null> }).services ?? null
    );

    const ACTIVE_PLAYBACK_QUERY = `
        query {
            activePlaybackSessions {
                server
                userName
                parentTitle
                itemTitle
                itemType
                seasonNumber
                episodeNumber
                playbackState
                playbackMethod
                positionSeconds
                durationSeconds
                deviceName
                clientName
                imageUrl
            }
        }
    `;

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

    const heatmapLegend = [
        { label: "No Activity", color: "var(--muted)" },
        { label: "Low", color: "var(--chart-4)" },
        { label: "Medium", color: "var(--chart-3)" },
        { label: "High", color: "var(--chart-2)" },
        { label: "Very High", color: "var(--chart-1)" }
    ];

    $effect(() => {
        activePlaybackSessions = data.activePlaybackSessions ?? [];
    });

    function playbackTone(state: string) {
        switch (state.toLowerCase()) {
            case "playing":
                return "default";
            case "paused":
                return "secondary";
            case "buffering":
                return "secondary";
            default:
                return "secondary";
        }
    }

    function playbackLabel(state: string) {
        return state.charAt(0).toUpperCase() + state.slice(1).toLowerCase();
    }

    function playbackMethodLabel(method: string) {
        switch (method.toLowerCase()) {
            case "directplay":
            case "direct_play":
                return "Direct Play";
            case "directstream":
            case "direct_stream":
                return "Direct Stream";
            case "transcode":
                return "Transcode";
            default:
                return "Unknown";
        }
    }

    function formatPlaybackTime(totalSeconds: number | null | undefined) {
        if (totalSeconds === null || totalSeconds === undefined || totalSeconds < 0) return null;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        }
        return `${minutes}:${String(seconds).padStart(2, "0")}`;
    }

    function formatEpisodeCode(session: ActivePlaybackSession) {
        if (session.seasonNumber === null || session.episodeNumber === null) return null;
        return `S${String(session.seasonNumber).padStart(2, "0")}E${String(session.episodeNumber).padStart(2, "0")}`;
    }

    function formatRemainingTime(session: ActivePlaybackSession) {
        if (
            session.positionSeconds === null ||
            session.durationSeconds === null ||
            session.durationSeconds <= session.positionSeconds
        ) {
            return null;
        }

        return formatPlaybackTime(session.durationSeconds - session.positionSeconds);
    }

    function formatOptionalNumber(value: number | null | undefined) {
        return typeof value === "number" ? value.toLocaleString() : null;
    }

    function showSeparateClient(session: ActivePlaybackSession) {
        if (!session.deviceName || !session.clientName) return false;
        return session.deviceName.trim().toLowerCase() !== session.clientName.trim().toLowerCase();
    }

    function progressWidth(session: ActivePlaybackSession) {
        if (
            session.positionSeconds === null ||
            session.positionSeconds === undefined ||
            session.durationSeconds === null ||
            session.durationSeconds === undefined ||
            session.durationSeconds <= 0
        ) {
            return 0;
        }

        return Math.max(
            0,
            Math.min(100, (session.positionSeconds / session.durationSeconds) * 100)
        );
    }

    onMount(() => {
        let cancelled = false;

        const refresh = async () => {
            try {
                const result =
                    await gqlClient<{ activePlaybackSessions: ActivePlaybackSession[] }>(
                        ACTIVE_PLAYBACK_QUERY
                    );
                if (!cancelled) {
                    activePlaybackSessions = result.activePlaybackSessions ?? [];
                }
            } catch {
                // Keep the last successful snapshot on transient dashboard polling failures.
            }
        };

        const interval = window.setInterval(refresh, 15000);
        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    });
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
                        props={{
                            spline: { curve: curveCatmullRom },
                            xAxis: {
                                ticks: data.statistics?.media_year_releases?.map((d) => d.year) ?? [],
                                format: (d: number) => String(d)
                            }
                        }}>
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
                    {#if serviceStatuses && Object.keys(serviceStatuses).length > 0}
                        {#each Object.entries(serviceStatuses) as [serviceName, status] (serviceName)}
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
                                : downloader.premium_status === "trial"
                                  ? "secondary"
                                  : "destructive"}
                            class={downloader.premium_status === "premium"
                                ? "rounded-xl bg-amber-600/30 text-amber-300 hover:bg-amber-600/40"
                                : downloader.premium_status === "trial"
                                  ? "rounded-xl bg-blue-600/20 text-blue-300"
                                  : "rounded-xl"}>
                            {downloader.premium_status === "premium"
                                ? "Premium"
                                : downloader.premium_status === "trial"
                                  ? "Trial"
                                  : "Expired"}
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
                        {#if typeof downloader.points === "number"}
                            <div>
                                <p class="text-xs font-medium text-neutral-400">Points</p>
                                <p class="mt-0.5 text-sm font-medium text-neutral-100">
                                    {formatOptionalNumber(downloader.points)}
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

    <section class="mb-8 grid grid-cols-1">
        <Card.Root>
            <Card.Header class="pb-2">
                <div class="flex items-center justify-between gap-3">
                    <Card.Title class="text-sm font-medium text-neutral-300">
                        Watching Now
                    </Card.Title>
                    <span class="text-xs text-neutral-500">Refreshes every 15s</span>
                </div>
            </Card.Header>
            <Card.Content>
                {#if activePlaybackSessions.length === 0}
                    <p class="text-sm text-neutral-400">No active playback sessions.</p>
                {:else}
                    <div class="grid gap-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {#each activePlaybackSessions as session (`${session.server}:${session.userName ?? "unknown"}:${session.itemTitle}`)}
                            <div class="rounded-md border border-white/6 bg-white/[0.02] p-2.5">
                                <div class="flex gap-2.5">
                                    <div class="h-16 w-12 shrink-0 overflow-hidden rounded-md border border-white/8 bg-white/[0.04]">
                                        {#if session.imageUrl}
                                            <img
                                                src={session.imageUrl}
                                                alt={session.parentTitle ?? session.itemTitle}
                                                class="h-full w-full object-cover"
                                                loading="lazy" />
                                        {:else}
                                            <div class="flex h-full w-full items-center justify-center text-[10px] text-neutral-500">
                                                {session.itemType ?? "Media"}
                                            </div>
                                        {/if}
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <div class="flex items-start justify-between gap-2">
                                            <div class="min-w-0">
                                                <div class="flex flex-wrap items-center gap-1.5">
                                                    <span class="truncate text-[13px] font-semibold leading-tight text-neutral-100">
                                                        {session.parentTitle ?? session.itemTitle}
                                                    </span>
                                                    {#if formatEpisodeCode(session)}
                                                        <Badge variant="outline" class="rounded-md px-1.5 py-0 text-[10px]">
                                                            {formatEpisodeCode(session)}
                                                        </Badge>
                                                    {/if}
                                                </div>
                                                {#if session.parentTitle}
                                                    <p class="mt-0.5 line-clamp-1 text-[11px] text-neutral-300">
                                                        {session.itemTitle}
                                                    </p>
                                                {/if}
                                            </div>
                                            <Badge
                                                variant={playbackTone(session.playbackState)}
                                                class="rounded-md px-1.5 py-0 text-[10px]">
                                                {playbackLabel(session.playbackState)}
                                            </Badge>
                                        </div>

                                        <div class="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-neutral-500">
                                            <span class="truncate">
                                                {session.userName ?? "Unknown user"} on {session.server}
                                            </span>
                                            <span class="text-neutral-600">•</span>
                                            <span>{playbackMethodLabel(session.playbackMethod)}</span>
                                            {#if session.itemType}
                                                <span class="text-neutral-600">•</span>
                                                <span>{session.itemType}</span>
                                            {/if}
                                        </div>

                                        <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-500">
                                            <span class="truncate">
                                                <span class="text-neutral-400">
                                                    {session.deviceName ? "Device" : "Client"}
                                                </span>
                                                <span class="ml-1 text-neutral-200">
                                                    {session.deviceName ?? session.clientName ?? "Unknown"}
                                                </span>
                                            </span>
                                            {#if showSeparateClient(session)}
                                                <span class="truncate">
                                                    <span class="text-neutral-400">Client</span>
                                                    <span class="ml-1 text-neutral-200">
                                                        {session.clientName}
                                                    </span>
                                                </span>
                                            {/if}
                                        </div>

                                        {#if session.positionSeconds !== null && session.positionSeconds !== undefined && session.durationSeconds !== null && session.durationSeconds !== undefined}
                                            <div class="mt-1.5">
                                                <div class="mb-1 flex items-center justify-between text-[10px] text-neutral-500">
                                                    <span>{formatPlaybackTime(session.positionSeconds) ?? "--:--"}</span>
                                                    <span>{formatPlaybackTime(session.durationSeconds) ?? "--:--"}</span>
                                                </div>
                                                <div class="relative h-1 overflow-hidden rounded-full bg-white/8">
                                                    <div
                                                        class="relative h-full rounded-full bg-[var(--chart-1)]"
                                                        style={`width: ${progressWidth(session)}%`}>
                                                        <span
                                                            class="absolute top-1/2 right-0 h-2 w-2 -translate-y-1/2 translate-x-1/2 rounded-full border border-white/70 bg-[var(--chart-1)] shadow-[0_0_8px_color-mix(in_oklab,var(--chart-1)_45%,transparent)]"></span>
                                                    </div>
                                                </div>
                                                {#if formatRemainingTime(session)}
                                                    <p class="mt-1 text-right text-[10px] text-neutral-500">
                                                        {formatRemainingTime(session)} left
                                                    </p>
                                                {/if}
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </Card.Content>
        </Card.Root>
    </section>
</PageShell>
