<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import LoadingSpinner from "./loading-spinner.svelte";

    const { Story } = defineMeta({
        title: "logs/LoadingSpinner",
        component: LoadingSpinner,
        tags: ["autodocs"]
    });
</script>

<Story name="Default" args={{ message: "Loading historical logs..." }} />
