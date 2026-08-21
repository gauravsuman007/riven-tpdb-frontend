<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import MobileNav from "./mobile-nav.svelte";
    import AppStoreContextDecorator from "$lib/storybook/decorators/AppStoreContextDecorator.svelte";

    const { Story } = defineMeta({
        title: "components/MobileNav",
        component: MobileNav,
        tags: ["autodocs"],
        decorators: [() => ({ Component: AppStoreContextDecorator })],
        parameters: {
            layout: "fullscreen",
            sveltekit_experimental: {
                navigation: {
                    afterNavigate: { type: "enter" }
                }
            }
        }
    });
</script>

<Story name="Default" asChild>
    <div class="relative h-64 bg-zinc-900">
        <MobileNav />
    </div>
</Story>
