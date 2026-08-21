<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import Header from "./header.svelte";
    import AppStoreContextDecorator from "$lib/storybook/decorators/AppStoreContextDecorator.svelte";

    const { Story } = defineMeta({
        title: "components/Header",
        component: Header,
        tags: ["autodocs"],
        decorators: [() => ({ Component: AppStoreContextDecorator })],
        parameters: {
            layout: "fullscreen"
        }
    });
</script>

<Story name="Default" asChild>
    <div class="relative h-40 bg-zinc-900">
        <Header />
    </div>
</Story>
