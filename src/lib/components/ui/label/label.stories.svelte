<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import Label from "./label.svelte";
    import { Checkbox } from "$lib/components/ui/checkbox/index.js";

    const { Story } = defineMeta({
        title: "ui/Label",
        component: Label,
        tags: ["autodocs"]
    });
</script>

<Story name="Default">Email address</Story>

<Story name="WithControl" asChild>
    <div class="flex items-center gap-2">
        <Checkbox id="marketing" />
        <Label for="marketing">Receive marketing emails</Label>
    </div>
</Story>
