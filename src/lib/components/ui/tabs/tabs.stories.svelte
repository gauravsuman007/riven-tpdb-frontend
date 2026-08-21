<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import * as Tabs from "./index.js";

    const { Story } = defineMeta({
        title: "ui/Tabs",
        component: Tabs.Root,
        tags: ["autodocs"]
    });
</script>

<Story name="Default" asChild>
    <Tabs.Root value="account" class="w-full max-w-md">
        <Tabs.List class="w-full">
            <Tabs.Trigger value="account">Account</Tabs.Trigger>
            <Tabs.Trigger value="password">Password</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="account">
            <p class="text-muted-foreground text-sm">
                Make changes to your account here. Click save when you're done.
            </p>
        </Tabs.Content>
        <Tabs.Content value="password">
            <p class="text-muted-foreground text-sm">
                Change your password here. After saving, you'll be logged out.
            </p>
        </Tabs.Content>
    </Tabs.Root>
</Story>

<Story name="LineVariant" asChild>
    <Tabs.Root value="tab1" class="w-full max-w-md">
        <Tabs.List variant="line" class="w-full">
            <Tabs.Trigger value="tab1">Overview</Tabs.Trigger>
            <Tabs.Trigger value="tab2">Analytics</Tabs.Trigger>
            <Tabs.Trigger value="tab3">Reports</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="tab1">
            <p class="text-muted-foreground text-sm">Overview content.</p>
        </Tabs.Content>
        <Tabs.Content value="tab2">
            <p class="text-muted-foreground text-sm">Analytics content.</p>
        </Tabs.Content>
        <Tabs.Content value="tab3">
            <p class="text-muted-foreground text-sm">Reports content.</p>
        </Tabs.Content>
    </Tabs.Root>
</Story>
