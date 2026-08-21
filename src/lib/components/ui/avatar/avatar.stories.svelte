<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import * as Avatar from "./index.js";

    const { Story } = defineMeta({
        title: "ui/Avatar",
        component: Avatar.Root,
        tags: ["autodocs"]
    });
</script>

<Story name="WithImage" asChild>
    <Avatar.Root>
        <Avatar.Image src="https://github.com/shadcn.png" alt="@shadcn" />
        <Avatar.Fallback>CN</Avatar.Fallback>
    </Avatar.Root>
</Story>

<Story name="Fallback" asChild>
    <Avatar.Root>
        <Avatar.Image src="https://broken-image-url.invalid/none.png" alt="Broken" />
        <Avatar.Fallback>JD</Avatar.Fallback>
    </Avatar.Root>
</Story>
