<script lang="ts">
    import * as Card from "$lib/components/ui/card/index.js";
    import * as Chart from "$lib/components/ui/chart/index.js";
    import ResponsiveChartContainer from "$lib/components/media/riven/responsive-chart-container.svelte";
    import { LineChart } from "layerchart";
    import { curveCatmullRom } from "d3-shape";

    let {
        data
    }: {
        data: { year: number; count: number }[];
    } = $props();

    let width = $state(0);

    const tickStep = $derived.by(() =>
        data.length <= 1
            ? 1
            : Math.max(1, Math.ceil(data.length / Math.max(4, Math.floor(width / 72))))
    );
    const ticks = $derived.by(() =>
        data
            .filter(
                (_, index) => index === 0 || index === data.length - 1 || index % tickStep === 0
            )
            .map((item) => item.year)
    );
    const showLabels = $derived.by(() => (data.length === 0 ? false : width / data.length >= 26));
</script>

<section class="mb-8 grid grid-cols-1">
    <Card.Root>
        <Card.Header class="pb-2">
            <Card.Title class="text-sm font-medium text-neutral-300">Release Year</Card.Title>
        </Card.Header>
        <Card.Content>
            <div bind:clientWidth={width} class="w-full">
                <ResponsiveChartContainer
                    config={{}}
                    class="aspect-3/1 w-full md:aspect-4/1 lg:aspect-5/1 2xl:aspect-6/1">
                    <LineChart
                        x="year"
                        data={data}
                        points
                        labels={showLabels ? { offset: 10 } : false}
                        series={[{ key: "count", color: "var(--chart-1)" }]}
                        padding={{ top: 16, bottom: 32, left: 32, right: 16 }}
                        props={{
                            spline: { curve: curveCatmullRom },
                            xAxis: {
                                ticks,
                                tickSpacing: 44,
                                format: (year: number) => String(year)
                            }
                        }}>
                        {#snippet tooltip()}
                            <Chart.Tooltip />
                        {/snippet}
                    </LineChart>
                </ResponsiveChartContainer>
            </div>
        </Card.Content>
    </Card.Root>
</section>
