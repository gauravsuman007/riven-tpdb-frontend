<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import KpiStatTile from "./kpi-stat-tile.svelte";

    const { Story } = defineMeta({
        title: "dashboard/KpiStatTile",
        component: KpiStatTile,
        tags: ["autodocs"]
    });
</script>

<Story name="Default" args={{ title: "Total Items", value: "12,483" }} />

<Story name="Warning" args={{ title: "Incomplete", value: "342", tone: "warning" }} />

<Story name="Row" asChild>
    <div class="grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-4">
        <KpiStatTile title="Total Items" value="12,483" />
        <KpiStatTile title="Completed" value="11,891" />
        <KpiStatTile title="Incomplete" value="342" tone="warning" />
        <KpiStatTile title="Completion Rate" value="95.25%" />
    </div>
</Story>
