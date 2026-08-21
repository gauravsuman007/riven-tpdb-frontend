<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import Badge from "./badge.svelte";

    const { Story } = defineMeta({
        title: "ui/Badge",
        component: Badge,
        tags: ["autodocs"],
        argTypes: {
            variant: {
                control: "select",
                options: ["default", "secondary", "destructive", "outline"]
            }
        },
        args: {
            variant: "default"
        }
    });
</script>

<Story name="Default">Badge</Story>

<Story name="Secondary" args={{ variant: "secondary" }}>Secondary</Story>

<Story name="Destructive" args={{ variant: "destructive" }}>Destructive</Story>

<Story name="Outline" args={{ variant: "outline" }}>Outline</Story>

<Story name="Variants" asChild>
    <div class="flex flex-wrap items-center gap-2">
        <Badge variant="default">Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Badge variant="outline">Outline</Badge>
    </div>
</Story>
