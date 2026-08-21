<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import RawDataDialog from "./raw-data-dialog.svelte";

    const { Story } = defineMeta({
        title: "media/riven/RawDataDialog",
        component: RawDataDialog,
        tags: ["autodocs"],
        args: {
            open: false,
            loading: false,
            error: undefined,
            json: JSON.stringify({ id: 123, state: "Completed" }, null, 2)
        }
    });
</script>

<Story name="Closed" />

<Story name="Open" args={{ open: true }} />

<Story name="Loading" args={{ open: true, loading: true, json: undefined }} />

<Story
    name="Error"
    args={{
        open: true,
        loading: false,
        error: "No full Riven data was returned for this item.",
        json: undefined
    }} />
