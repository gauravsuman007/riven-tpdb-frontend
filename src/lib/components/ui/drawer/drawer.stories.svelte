<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import * as Drawer from "./index.js";
    import { Button, buttonVariants } from "$lib/components/ui/button/index.js";

    const { Story } = defineMeta({
        title: "ui/Drawer",
        component: Drawer.Root,
        tags: ["autodocs"]
    });
</script>

<Story name="Default" asChild>
    <Drawer.Root>
        <Drawer.Trigger class={buttonVariants({ variant: "outline" })}>
            Open Drawer
        </Drawer.Trigger>
        <Drawer.Content>
            <div class="mx-auto w-full max-w-sm">
                <Drawer.Header>
                    <Drawer.Title>Move goal</Drawer.Title>
                    <Drawer.Description>Set your daily activity goal.</Drawer.Description>
                </Drawer.Header>
                <Drawer.Footer>
                    <Button>Submit</Button>
                    <Drawer.Close class={buttonVariants({ variant: "outline" })}>
                        Cancel
                    </Drawer.Close>
                </Drawer.Footer>
            </div>
        </Drawer.Content>
    </Drawer.Root>
</Story>
