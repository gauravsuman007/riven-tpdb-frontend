<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import ButtonGroup from "./button-group.svelte";
    import { Button } from "$lib/components/ui/button/index.js";

    const { Story } = defineMeta({
        title: "ui/ButtonGroup",
        component: ButtonGroup,
        tags: ["autodocs"],
        argTypes: {
            orientation: {
                control: "select",
                options: ["horizontal", "vertical"]
            }
        },
        args: {
            orientation: "horizontal"
        }
    });
</script>

<Story name="Horizontal" args={{ orientation: "horizontal" }} asChild>
    <ButtonGroup orientation="horizontal">
        <Button variant="outline">Left</Button>
        <Button variant="outline">Middle</Button>
        <Button variant="outline">Right</Button>
    </ButtonGroup>
</Story>

<Story name="Vertical" args={{ orientation: "vertical" }} asChild>
    <ButtonGroup orientation="vertical" class="w-40">
        <Button variant="outline">Top</Button>
        <Button variant="outline">Middle</Button>
        <Button variant="outline">Bottom</Button>
    </ButtonGroup>
</Story>
