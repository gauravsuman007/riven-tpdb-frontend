<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import ResponsiveChartContainer from "./responsive-chart-container.svelte";
    import { LineChart } from "layerchart";

    const { Story } = defineMeta({
        title: "media/riven/ResponsiveChartContainer",
        component: ResponsiveChartContainer,
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

<Story name="Default" asChild>
    <ResponsiveChartContainer config={{}} class="h-52 w-full max-w-lg">
        <LineChart
            x="year"
            {data}
            points
            labels={false}
            series={[{ key: "count", color: "var(--chart-1)" }]} />
    </ResponsiveChartContainer>
</Story>
