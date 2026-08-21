<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import Toggle from "./toggle.svelte";
    import Bold from "@lucide/svelte/icons/bold";

    const { Story } = defineMeta({
        title: "ui/Toggle",
        component: Toggle,
        tags: ["autodocs"],
        argTypes: {
            variant: {
                control: "select",
                options: ["default", "outline"]
            },
            size: {
                control: "select",
                options: ["default", "sm", "lg"]
            }
        },
        args: {
            variant: "default",
            size: "default"
        }
    });
</script>

<Story name="Default" asChild>
    <Toggle aria-label="Toggle bold">
        <Bold class="size-4" />
    </Toggle>
</Story>

<Story name="Outline" args={{ variant: "outline" }} asChild>
    <Toggle variant="outline" aria-label="Toggle bold">
        <Bold class="size-4" />
    </Toggle>
</Story>

<Story name="Pressed" asChild>
    <Toggle pressed aria-label="Toggle bold">
        <Bold class="size-4" />
    </Toggle>
</Story>

<Story name="Disabled" asChild>
    <Toggle disabled aria-label="Toggle bold">
        <Bold class="size-4" />
    </Toggle>
</Story>
