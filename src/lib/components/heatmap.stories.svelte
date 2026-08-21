<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import Heatmap from "./heatmap.svelte";

    const { Story } = defineMeta({
        title: "components/Heatmap",
        component: Heatmap,
        tags: ["autodocs"]
    });
</script>

<script lang="ts">
    function buildActivity() {
        const activity: Record<string, number> = {};
        const today = new Date();
        for (let i = 0; i < 365; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const key = date.toISOString().slice(0, 10);
            activity[key] = Math.max(0, Math.round(Math.random() * 5 - (i % 5 === 0 ? 3 : 0)));
        }
        return activity;
    }

    const data = buildActivity();
</script>

<Story name="Default" args={{ data }} />

<Story name="Empty" args={{ data: {} }} />
