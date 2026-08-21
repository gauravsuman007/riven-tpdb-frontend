<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import * as Chart from "./index.js";
    import { LineChart } from "layerchart";

    const { Story } = defineMeta({
        title: "ui/Chart",
        component: Chart.ChartContainer,
        tags: ["autodocs"]
    });

    const data = [
        { year: 2020, count: 12 },
        { year: 2021, count: 28 },
        { year: 2022, count: 19 },
        { year: 2023, count: 41 },
        { year: 2024, count: 35 }
    ];
</script>

<Story name="LineChart" asChild>
    <Chart.ChartContainer config={{}} class="h-52 w-full max-w-lg">
        <LineChart
            x="year"
            {data}
            points
            labels={false}
            series={[{ key: "count", color: "var(--chart-1)" }]}
            padding={{ top: 16, bottom: 32, left: 32, right: 16 }}>
            {#snippet tooltip()}
                <Chart.ChartTooltip />
            {/snippet}
        </LineChart>
    </Chart.ChartContainer>
</Story>
