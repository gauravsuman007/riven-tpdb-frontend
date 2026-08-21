<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import KbdRoot from "./kbd.svelte";
    import KbdGroup from "./kbd-group.svelte";

    const { Story } = defineMeta({
        title: "ui/Kbd",
        component: KbdRoot,
        tags: ["autodocs"]
    });
</script>

<Story name="Default">⌘</Story>

<Story name="Combo" asChild>
    <KbdGroup>
        <KbdRoot>⌘</KbdRoot>
        <KbdRoot>K</KbdRoot>
    </KbdGroup>
</Story>
