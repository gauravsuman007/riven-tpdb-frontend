<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import Skeleton from "./skeleton.svelte";

    const { Story } = defineMeta({
        title: "ui/Skeleton",
        component: Skeleton,
        tags: ["autodocs"]
    });
</script>

<Story name="Default" args={{ class: "h-8 w-48" }} />

<Story name="Card" asChild>
    <div class="flex flex-col gap-3">
        <Skeleton class="h-40 w-64 rounded-xl" />
        <div class="flex flex-col gap-2">
            <Skeleton class="h-4 w-48" />
            <Skeleton class="h-4 w-32" />
        </div>
    </div>
</Story>

<Story name="Avatar" asChild>
    <div class="flex items-center gap-4">
        <Skeleton class="size-12 rounded-full" />
        <div class="flex flex-col gap-2">
            <Skeleton class="h-4 w-32" />
            <Skeleton class="h-3 w-24" />
        </div>
    </div>
</Story>
