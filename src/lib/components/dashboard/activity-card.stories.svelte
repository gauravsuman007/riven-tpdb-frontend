<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import ActivityCard from "./activity-card.svelte";

    const { Story } = defineMeta({
        title: "dashboard/ActivityCard",
        component: ActivityCard,
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
            activity[key] = Math.max(0, Math.round(Math.random() * 8 - (i % 7 === 0 ? 4 : 0)));
        }
        return activity;
    }

    const activity = buildActivity();
</script>

<Story name="Default" args={{ activity }} />

<Story name="Empty" args={{ activity: {} }} />
