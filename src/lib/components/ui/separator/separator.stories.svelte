<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import Separator from "./separator.svelte";

    const { Story } = defineMeta({
        title: "ui/Separator",
        component: Separator,
        tags: ["autodocs"]
    });
</script>

<Story name="Horizontal" asChild>
    <div class="w-64">
        <div class="text-sm font-medium">Riven</div>
        <div class="text-muted-foreground text-sm">Media management</div>
        <Separator class="my-4" />
        <div class="flex h-5 items-center gap-4 text-sm">
            <div>Blog</div>
            <Separator orientation="vertical" />
            <div>Docs</div>
            <Separator orientation="vertical" />
            <div>Source</div>
        </div>
    </div>
</Story>
