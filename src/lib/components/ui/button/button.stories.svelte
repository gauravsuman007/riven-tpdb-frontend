<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import Button from "./button.svelte";

    const { Story } = defineMeta({
        title: "ui/Button",
        component: Button,
        tags: ["autodocs"],
        argTypes: {
            variant: {
                control: "select",
                options: ["default", "outline", "secondary", "ghost", "destructive", "link"]
            },
            size: {
                control: "select",
                options: ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"]
            },
            disabled: { control: "boolean" }
        },
        args: {
            variant: "default",
            size: "default",
            disabled: false
        }
    });
</script>

<Story name="Default">Button</Story>

<Story name="Outline" args={{ variant: "outline" }}>Button</Story>

<Story name="Secondary" args={{ variant: "secondary" }}>Button</Story>

<Story name="Ghost" args={{ variant: "ghost" }}>Button</Story>

<Story name="Destructive" args={{ variant: "destructive" }}>Button</Story>

<Story name="Link" args={{ variant: "link" }}>Button</Story>

<Story name="Disabled" args={{ disabled: true }}>Button</Story>

<Story name="Variants" asChild>
    <div class="flex flex-wrap items-center gap-2">
        <Button variant="default">Default</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
    </div>
</Story>

<Story name="Sizes" asChild>
    <div class="flex flex-wrap items-center gap-2">
        <Button size="xs">Extra small</Button>
        <Button size="sm">Small</Button>
        <Button size="default">Default</Button>
        <Button size="lg">Large</Button>
    </div>
</Story>
