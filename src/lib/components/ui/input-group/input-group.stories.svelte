<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import * as InputGroup from "./index.js";
    import SearchIcon from "@lucide/svelte/icons/search";
    import { Kbd } from "$lib/components/ui/kbd/index.js";

    const { Story } = defineMeta({
        title: "ui/InputGroup",
        component: InputGroup.Root,
        tags: ["autodocs"]
    });
</script>

<Story name="Default" asChild>
    <InputGroup.Root class="w-full max-w-sm">
        <InputGroup.Addon align="inline-start">
            <SearchIcon class="size-4" />
        </InputGroup.Addon>
        <InputGroup.Input placeholder="Search..." />
    </InputGroup.Root>
</Story>

<Story name="WithTrailingKbd" asChild>
    <InputGroup.Root class="w-full max-w-sm">
        <InputGroup.Addon align="inline-start">
            <SearchIcon class="size-4" />
        </InputGroup.Addon>
        <InputGroup.Input placeholder="Search..." />
        <InputGroup.Addon align="inline-end">
            <Kbd>⌘K</Kbd>
        </InputGroup.Addon>
    </InputGroup.Root>
</Story>
