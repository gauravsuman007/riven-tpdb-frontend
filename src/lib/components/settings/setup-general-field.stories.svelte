<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import SetupGeneralField from "./setup-general-field.svelte";

    const { Story } = defineMeta({
        title: "settings/SetupGeneralField",
        component: SetupGeneralField,
        tags: ["autodocs"]
    });
</script>

<Story
    name="Default"
    args={{
        field: { key: "instance_name", label: "Instance Name", type: "string", required: true },
        general: { instance_name: "My Riven Instance" }
    }} />
