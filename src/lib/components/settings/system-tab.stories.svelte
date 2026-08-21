<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import SystemTab from "./system-tab.svelte";

    const { Story } = defineMeta({
        title: "settings/SystemTab",
        component: SystemTab,
        tags: ["autodocs"]
    });
</script>

<Story name="Default" />
