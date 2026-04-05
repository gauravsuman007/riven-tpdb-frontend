<script lang="ts">
    import * as Card from "$lib/components/ui/card/index.js";
    import * as Chart from "$lib/components/ui/chart/index.js";
    import ResponsiveChartContainer from "$lib/components/media/riven/responsive-chart-container.svelte";
    import { BarChart, PieChart } from "layerchart";
    import type { DashboardStatistics } from "./types";

    let { statistics }: { statistics: DashboardStatistics | undefined } = $props();

    const stateRows = $derived.by(() =>
        Object.entries(statistics?.states ?? {})
            .filter(([, value]) => value > 0)
            .map(([label, value]) => ({ label, value }))
    );

    const contentRows = $derived.by(() =>
        !statistics
            ? []
            : [
                  ["Movies", statistics.total_movies, "#ef4444"],
                  ["Shows", statistics.total_shows, "#14b8a6"],
                  ["Seasons", statistics.total_seasons, "#60a5fa"],
                  ["Episodes", statistics.total_episodes, "#f59e0b"]
              ].map(([label, value, color]) => ({
                  label: String(label),
                  value: Number(value),
                  color: String(color)
              }))
    );
</script>

{#snippet Rows({ items }: { items: { label: string; value: number; color?: string }[] })}
    <div class="mt-auto pt-4">
        {#each items as item (item.label)}
            <div class="mt-4 flex items-center gap-2 first:mt-0">
                {#if item.color}
                    <span
                        class="inline-block h-3 w-3 shrink-0 rounded-sm"
                        style="background-color: {item.color}"></span>
                {/if}
                <span class="text-sm text-neutral-300">{item.label}</span>
                <span class="ml-auto font-mono text-sm text-neutral-50">
                    {item.value.toLocaleString()}
                </span>
            </div>
        {/each}
    </div>
{/snippet}

<section class="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
    <Card.Root class="flex h-full flex-col">
        <Card.Header class="pb-2">
            <Card.Title class="text-sm font-medium text-neutral-300">Library States</Card.Title>
        </Card.Header>
        <Card.Content class="flex flex-1 flex-col">
            <ResponsiveChartContainer config={{}} class="min-h-[300px] w-full flex-1">
                <BarChart
                    data={stateRows}
                    x="label"
                    y="value"
                    c="label"
                    labels
                    padding={{ top: 16, bottom: 32, left: 32, right: 16 }}
                    props={{ bars: { class: "fill-primary" } }}>
                    {#snippet tooltip()}
                        <Chart.Tooltip />
                    {/snippet}
                </BarChart>
            </ResponsiveChartContainer>
            {@render Rows({ items: stateRows })}
        </Card.Content>
    </Card.Root>

    <Card.Root class="flex h-full flex-col">
        <Card.Header class="pb-2">
            <Card.Title class="text-sm font-medium text-neutral-300">Content Breakdown</Card.Title>
        </Card.Header>
        <Card.Content class="flex flex-1 flex-col">
            <ResponsiveChartContainer config={{}} class="min-h-[300px] w-full flex-1">
                <PieChart
                    data={contentRows}
                    key="label"
                    value="value"
                    c="color"
                    innerRadius={-50}
                    cornerRadius={5}
                    padAngle={0.02}
                    padding={{ top: 16, bottom: 32, left: 32, right: 16 }}>
                    {#snippet tooltip()}
                        <Chart.Tooltip />
                    {/snippet}
                </PieChart>
            </ResponsiveChartContainer>
            {@render Rows({ items: contentRows })}
        </Card.Content>
    </Card.Root>
</section>
