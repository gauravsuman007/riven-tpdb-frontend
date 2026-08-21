<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import PortraitCardSkeleton from "./portrait-card-skeleton.svelte";

    const { Story } = defineMeta({
        title: "media/PortraitCardSkeleton",
        component: PortraitCardSkeleton,
        tags: ["autodocs"]
    });
</script>

<Story name="Default" asChild>
    <div class="w-48">
        <PortraitCardSkeleton />
    </div>
</Story>

<Story name="Grid" asChild>
    <div class="grid w-full max-w-2xl grid-cols-4 gap-4">
        {#each Array(8) as _, i (i)}
            <PortraitCardSkeleton />
        {/each}
    </div>
</Story>
