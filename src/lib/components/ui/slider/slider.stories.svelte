<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import Slider from "./slider.svelte";

    const { Story } = defineMeta({
        title: "ui/Slider",
        component: Slider,
        tags: ["autodocs"]
    });
</script>

<Story name="Default" args={{ value: [50], class: "w-64" }} />

<Story name="Range" args={{ value: [25, 75], class: "w-64" }} />

<Story name="Disabled" args={{ value: [40], disabled: true, class: "w-64" }} />

<Story name="Vertical" args={{ value: [50], orientation: "vertical", class: "h-40" }} />
