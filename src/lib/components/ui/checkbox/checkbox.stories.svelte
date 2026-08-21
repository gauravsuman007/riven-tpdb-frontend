<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import Checkbox from "./checkbox.svelte";
    import { Label } from "$lib/components/ui/label/index.js";

    const { Story } = defineMeta({
        title: "ui/Checkbox",
        component: Checkbox,
        tags: ["autodocs"],
        args: {
            checked: false
        }
    });
</script>

<Story name="Default" />

<Story name="Checked" args={{ checked: true }} />

<Story name="Indeterminate" args={{ indeterminate: true }} />

<Story name="Disabled" args={{ disabled: true }} />

<Story name="WithLabel" asChild>
    <div class="flex items-center gap-2">
        <Checkbox id="terms" />
        <Label for="terms">Accept terms and conditions</Label>
    </div>
</Story>
