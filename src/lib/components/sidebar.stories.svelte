<script module lang="ts">
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import Sidebar from "./sidebar.svelte";
    import AppStoreContextDecorator from "$lib/storybook/decorators/AppStoreContextDecorator.svelte";

    const { Story } = defineMeta({
        title: "components/Sidebar",
        component: Sidebar,
        tags: ["autodocs"],
        // `Sidebar`'s untyped `user` prop makes svelte-check treat this decorator's
        // generated prop type as unrelated to the one `defineMeta` expects here;
        // the cast is a type-level-only workaround, verified to render correctly.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        decorators: [() => ({ Component: AppStoreContextDecorator as any })],
        parameters: {
            layout: "fullscreen"
        }
    });
</script>

<Story name="AdminUser" asChild>
    <div class="h-screen bg-zinc-950">
        <Sidebar
            user={{
                name: "Alice Admin",
                username: "alice",
                role: "admin",
                image: null
            }} />
    </div>
</Story>

<Story name="RegularUser" asChild>
    <div class="h-screen bg-zinc-950">
        <Sidebar
            user={{
                name: "Bob Viewer",
                username: "bob",
                role: "user",
                image: null
            }} />
    </div>
</Story>

<Story name="Guest" asChild>
    <div class="h-screen bg-zinc-950">
        <Sidebar user={undefined} />
    </div>
</Story>
