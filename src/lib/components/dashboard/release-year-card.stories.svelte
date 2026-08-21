<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import ReleaseYearCard from "./release-year-card.svelte";

    const { Story } = defineMeta({
        title: "dashboard/ReleaseYearCard",
        component: ReleaseYearCard,
        tags: ["autodocs"]
    });
</script>

<script lang="ts">
    const data = [
        { year: 2018, count: 34 },
        { year: 2019, count: 51 },
        { year: 2020, count: 62 },
        { year: 2021, count: 88 },
        { year: 2022, count: 121 },
        { year: 2023, count: 154 },
        { year: 2024, count: 178 }
    ];
</script>

<Story name="Default" args={{ data }} />

<Story name="Empty" args={{ data: [] }} />
