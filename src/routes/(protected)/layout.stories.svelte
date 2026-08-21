<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import ProtectedLayout from "./+layout.svelte";

    const { Story } = defineMeta({
        title: "pages/AppShell",
        component: ProtectedLayout,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen",
            docs: {
                description: {
                    component:
                        "Sidebar + Header + MobileNav composed together as the real root layout renders them, for visual QA of the full app chrome. Creates its own `searchStore`/`filterStore`/`sidebarStore` context internally, so no decorator is needed."
                }
            },
            // MobileNav embeds SearchModal, whose afterNavigate callback crashes on the
            // framework mock's default undefined argument — same fix as mobile-nav.stories.svelte.
            sveltekit_experimental: {
                navigation: { afterNavigate: { type: "enter" } }
            }
        }
    });
</script>

<Story name="Default" asChild>
    <ProtectedLayout
        params={{}}
        data={{
            user: { id: "1", name: "Alice Admin", username: "alice", role: "admin", image: null },
            permissions: {
                role: "admin",
                canRequestItems: true,
                canManageLibrary: true,
                canManageSettings: true
            }
        }}>
        {#snippet children()}
            <div class="p-8">
                <h1 class="text-foreground text-3xl font-bold tracking-tight">Page content</h1>
                <p class="text-muted-foreground mt-2">
                    Placeholder content rendered inside the app shell's main scroll area.
                </p>
            </div>
        {/snippet}
    </ProtectedLayout>
</Story>
