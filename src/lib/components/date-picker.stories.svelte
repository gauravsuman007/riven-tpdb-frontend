<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import DatePicker from "./date-picker.svelte";

    const { Story } = defineMeta({
        title: "components/DatePicker",
        component: DatePicker,
        tags: ["autodocs"]
    });
</script>

<Story name="Empty" />

<Story name="WithValue" args={{ value: "2024-06-12" }} />
