<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import * as Select from "./index.js";

    const { Story } = defineMeta({
        title: "ui/Select",
        component: Select.Root,
        tags: ["autodocs"]
    });

    const fruits = [
        { value: "apple", label: "Apple" },
        { value: "banana", label: "Banana" },
        { value: "blueberry", label: "Blueberry" },
        { value: "grapes", label: "Grapes" },
        { value: "pineapple", label: "Pineapple" }
    ];
</script>

<Story name="Default" asChild>
    <Select.Root type="single" value="apple">
        <Select.Trigger class="w-[180px]">
            <span class="truncate">Apple</span>
        </Select.Trigger>
        <Select.Content>
            {#each fruits as fruit (fruit.value)}
                <Select.Item value={fruit.value} label={fruit.label}>
                    {fruit.label}
                </Select.Item>
            {/each}
        </Select.Content>
    </Select.Root>
</Story>

<Story name="WithGroupLabel" asChild>
    <Select.Root type="single">
        <Select.Trigger class="w-[180px]">
            <span class="truncate">Select a fruit</span>
        </Select.Trigger>
        <Select.Content>
            <Select.Group>
                <Select.GroupHeading>Fruits</Select.GroupHeading>
                {#each fruits as fruit (fruit.value)}
                    <Select.Item value={fruit.value} label={fruit.label}>
                        {fruit.label}
                    </Select.Item>
                {/each}
            </Select.Group>
        </Select.Content>
    </Select.Root>
</Story>
