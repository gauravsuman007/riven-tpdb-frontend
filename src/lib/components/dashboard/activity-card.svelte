<script lang="ts">
    import * as Card from "$lib/components/ui/card/index.js";
    import Heatmap from "$lib/components/heatmap.svelte";

    let { activity }: { activity: Record<string, number> } = $props();

    const heatmapLegend = [
        { label: "No Activity", color: "var(--muted)" },
        { label: "Low", color: "var(--chart-4)" },
        { label: "Medium", color: "var(--chart-3)" },
        { label: "High", color: "var(--chart-2)" },
        { label: "Very High", color: "var(--chart-1)" }
    ];
</script>

<Card.Root>
    <Card.Header class="pb-2">
        <Card.Title class="text-sm font-medium text-neutral-300">Activity Chart</Card.Title>
    </Card.Header>
    <Card.Content>
        <Heatmap
            data={activity}
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
