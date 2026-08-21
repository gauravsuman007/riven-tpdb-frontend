<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import PageShell from "./page-shell.svelte";

    const { Story } = defineMeta({
        title: "components/PageShell",
        component: PageShell,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen"
        }
    });
</script>

<Story name="Default" asChild>
    <PageShell>
        <h1 class="text-3xl font-bold tracking-tight">Page Title</h1>
        <p class="text-muted-foreground">
            Consistent page padding, max-width, and enter transition wrap around this content.
        </p>
    </PageShell>
</Story>
