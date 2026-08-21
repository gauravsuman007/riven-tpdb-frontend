<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import Switch from "./switch.svelte";
    import { Label } from "$lib/components/ui/label/index.js";

    const { Story } = defineMeta({
        title: "ui/Switch",
        component: Switch,
        tags: ["autodocs"],
        argTypes: {
            size: {
                control: "select",
                options: ["default", "sm"]
            }
        },
        args: {
            checked: false
        }
    });
</script>

<Story name="Default" />

<Story name="Checked" args={{ checked: true }} />

<Story name="Disabled" args={{ disabled: true }} />

<Story name="Small" args={{ size: "sm" }} />

<Story name="WithLabel" asChild>
    <div class="flex items-center gap-2">
        <Switch id="airplane-mode" />
        <Label for="airplane-mode">Airplane Mode</Label>
    </div>
</Story>
