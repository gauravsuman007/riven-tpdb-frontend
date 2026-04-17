<script lang="ts">
    import PageShell from "$lib/components/page-shell.svelte";
    import { gqlClient } from "$lib/graphql-client";
    import { cn } from "$lib/utils";
    import type { PageData } from "./$types";
    import ActivityCard from "$lib/components/dashboard/activity-card.svelte";
    import LibraryChartsCard from "$lib/components/dashboard/library-charts-card.svelte";
    import ReleaseYearCard from "$lib/components/dashboard/release-year-card.svelte";
    import ServiceStatusCard from "$lib/components/dashboard/service-status-card.svelte";
    import DownloaderServicesGrid from "$lib/components/dashboard/downloader-services-grid.svelte";
    import WatchingNowCard from "$lib/components/dashboard/watching-now-card.svelte";
    import type { ActivePlaybackSession, DownloaderService } from "$lib/components/dashboard/types";
    import { onMount } from "svelte";
    import { invalidate } from "$app/navigation";
    import { subscribeToMediaUpdates } from "$lib/services/library-live-updates";

    const DASHBOARD_STATS_DEPENDENCY = "riven:dashboard-stats";

    let { data }: { data: PageData } = $props();

    let activePlaybackSessions = $state<ActivePlaybackSession[]>([]);
    let downloaderServices = $state<DownloaderService[]>([]);

    const statistics = $derived(data.statistics);
    const serviceStatuses = $derived(
        (data as PageData & { services?: Record<string, boolean | null> }).services ?? null
    );
    const completionRate = $derived.by(() => {
        if (
            !statistics ||
            statistics.total_items === 0 ||
            statistics.states.Completed === undefined
        ) {
            return "0%";
        }

        return `${((statistics.states.Completed / statistics.total_items) * 100).toFixed(2)}%`;
    });
    const kpiCards = $derived.by(() => [
        {
            title: "Total Items",
            value: statistics?.total_items.toLocaleString()
        },
        {
            title: "Completed",
            value: statistics?.states.Completed?.toLocaleString()
        },
        {
            title: "Incomplete",
            value: statistics?.incomplete_items.toLocaleString(),
            tone: "warning" as const
        },
        {
            title: "Completion Rate",
            value: completionRate
        }
    ]);

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

    const DEBRID_ACCOUNT_INFO_QUERY = `
        query {
            debridAccountInfo {
                store
                email
                username
                subscriptionStatus
                premiumUntil
                cooldownUntil
                totalDownloadedBytes
                points
            }
        }
    `;

    type GqlDebridAccountInfo = {
        store: string;
        email: string | null;
        username: string | null;
        subscriptionStatus: string | null;
        premiumUntil: string | null;
        cooldownUntil: string | null;
        totalDownloadedBytes: number | null;
        points: number | null;
    };

    function mapDebridService(info: GqlDebridAccountInfo): DownloaderService {
        const now = Date.now();
        const expiresMs = info.premiumUntil ? new Date(info.premiumUntil).getTime() : null;
        const daysLeft =
            expiresMs !== null && !isNaN(expiresMs)
                ? Math.ceil((expiresMs - now) / (1000 * 60 * 60 * 24))
                : null;

        return {
            service: info.store,
            email: info.email ?? null,
            username: info.username ?? null,
            premium_status: info.subscriptionStatus ?? "expired",
            premium_expires_at: info.premiumUntil ?? null,
            premium_days_left: daysLeft,
            points: info.points ?? null,
            total_downloaded_bytes: info.totalDownloadedBytes ?? null,
            cooldown_until: info.cooldownUntil ?? null
        };
    }

    $effect(() => {
        activePlaybackSessions = data.activePlaybackSessions ?? [];
        downloaderServices = data.downloaderInfo?.services ?? [];
    });

    $effect(() => {
        return subscribeToMediaUpdates(() => invalidate(DASHBOARD_STATS_DEPENDENCY));
    });

    onMount(() => {
        let cancelled = false;

        const refresh = async () => {
            try {
                const result = await gqlClient<{ activePlaybackSessions: ActivePlaybackSession[] }>(
                    ACTIVE_PLAYBACK_QUERY
                );
                if (!cancelled) {
                    activePlaybackSessions = result.activePlaybackSessions ?? [];
                }
            } catch {
                // Keep the last successful snapshot on transient dashboard polling failures.
            }
        };

        const refreshDownloaderServices = async () => {
            try {
                const result = await gqlClient<{ debridAccountInfo: GqlDebridAccountInfo[] }>(
                    DEBRID_ACCOUNT_INFO_QUERY
                );

                if (!cancelled) {
                    downloaderServices = (result.debridAccountInfo ?? []).map(mapDebridService);
                }
            } catch {
                // Service account lookups should never block the dashboard shell.
            }
        };

        void refresh();
        void refreshDownloaderServices();

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
    tone = "default"
}: {
    title: string;
    value: string | undefined;
    tone?: "default" | "warning";
})}
    <div class={cn("border-border/60 border-b py-5", tone === "warning" && "border-amber-600/30")}>
        <p class="text-sm font-medium text-neutral-300">{title}</p>
        <div
            class={cn(
                "mt-3 text-2xl font-semibold tracking-tight",
                tone === "warning" ? "text-amber-300" : "text-neutral-50"
            )}>
            {value}
        </div>
    </div>
{/snippet}

<PageShell class="mx-auto w-full max-w-7xl">
    <header class="border-border/60 border-b pb-6">
        <h1 class="text-3xl font-bold tracking-tight">Media Library Statistics</h1>
    </header>

    <section class="grid grid-cols-1 gap-x-10 gap-y-4 py-2 md:grid-cols-2 lg:grid-cols-4">
        {#each kpiCards as card (card.title)}
            {@render KPICard(card)}
        {/each}
    </section>

    <ActivityCard activity={statistics?.activity ?? {}} />
    <LibraryChartsCard {statistics} />
    <ReleaseYearCard data={statistics?.media_year_releases ?? []} />
    <ServiceStatusCard statuses={serviceStatuses} />
    <DownloaderServicesGrid services={downloaderServices} />
    <WatchingNowCard sessions={activePlaybackSessions} />
</PageShell>
