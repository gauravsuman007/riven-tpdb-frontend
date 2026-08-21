<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import * as Card from "./index.js";
    import { Button } from "$lib/components/ui/button/index.js";

    const { Story } = defineMeta({
        title: "ui/Card",
        component: Card.Root,
        tags: ["autodocs"],
    });
</script>

<Story name="Default" asChild>
    <Card.Root class="w-full max-w-sm">
        <Card.Header>
            <Card.Title>Create project</Card.Title>
            <Card.Description>Deploy your new project in one click.</Card.Description>
        </Card.Header>
        <Card.Content>
            <p class="text-muted-foreground text-sm">
                Fill in the details below to get started.
            </p>
        </Card.Content>
        <Card.Footer class="gap-2">
            <Button variant="outline">Cancel</Button>
            <Button>Deploy</Button>
        </Card.Footer>
    </Card.Root>
</Story>

<Story name="WithAction" asChild>
    <Card.Root class="w-full max-w-sm">
        <Card.Header>
            <Card.Title>Notifications</Card.Title>
            <Card.Description>You have 3 unread messages.</Card.Description>
            <Card.Action>
                <Button variant="ghost" size="sm">Mark all read</Button>
            </Card.Action>
        </Card.Header>
        <Card.Content>
            <p class="text-muted-foreground text-sm">No new activity since your last visit.</p>
        </Card.Content>
    </Card.Root>
</Story>
