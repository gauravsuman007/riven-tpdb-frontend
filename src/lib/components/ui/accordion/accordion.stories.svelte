<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import * as Accordion from "./index.js";

    const { Story } = defineMeta({
        title: "ui/Accordion",
        component: Accordion.Root,
        tags: ["autodocs"]
    });
</script>

<Story name="Single" asChild>
    <Accordion.Root type="single" class="w-full max-w-md">
        <Accordion.Item value="item-1">
            <Accordion.Trigger>Is it accessible?</Accordion.Trigger>
            <Accordion.Content>
                Yes. It adheres to the WAI-ARIA design pattern.
            </Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="item-2">
            <Accordion.Trigger>Is it styled?</Accordion.Trigger>
            <Accordion.Content>
                Yes. It comes with default styles that match the theme.
            </Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="item-3">
            <Accordion.Trigger>Is it animated?</Accordion.Trigger>
            <Accordion.Content>
                Yes. It's animated by default, but you can disable it if you prefer.
            </Accordion.Content>
        </Accordion.Item>
    </Accordion.Root>
</Story>

<Story name="Multiple" asChild>
    <Accordion.Root type="multiple" class="w-full max-w-md">
        <Accordion.Item value="item-1">
            <Accordion.Trigger>First section</Accordion.Trigger>
            <Accordion.Content>Multiple items can be open at the same time.</Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="item-2">
            <Accordion.Trigger>Second section</Accordion.Trigger>
            <Accordion.Content>Try opening this one too.</Accordion.Content>
        </Accordion.Item>
    </Accordion.Root>
</Story>
