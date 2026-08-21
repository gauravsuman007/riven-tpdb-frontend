<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import LibraryPage from "./+page.svelte";

    const { Story } = defineMeta({
        title: "pages/Library",
        component: LibraryPage,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen",
            docs: {
                description: {
                    component:
                        "A static snapshot only: bulk Reset/Retry/Remove actions call real server-side remote functions and a live-update subscription refetches the grid — neither is exercised here, just one fixed render from a resolved `pageData` promise."
                }
            }
        }
    });
</script>

<script lang="ts">
    import { defaults } from "sveltekit-superforms";
    import { zod4 } from "sveltekit-superforms/adapters";
    import { itemsSearchSchema } from "$lib/schemas/items";
    import { getPermissionFlags } from "$lib/permissions";

    const user = { id: "1", name: "Alice", email: "alice@example.com" };
    const permissions = getPermissionFlags("user");

    const itemsSearchForm = defaults(zod4(itemsSearchSchema));

    const items = [
        {
            id: "603692",
            title: "John Wick: Chapter 4",
            poster_path: null,
            media_type: "movie",
            year: 2023,
            indexer: "tmdb" as const,
            type: "movie",
            details_query: "",
            badge: undefined,
            riven_id: 1
        },
        {
            id: "94605",
            title: "Arcane",
            poster_path: null,
            media_type: "tv",
            year: 2024,
            indexer: "tmdb" as const,
            type: "tv",
            details_query: "season=2",
            badge: { text: "Season", variant: "default" as const },
            riven_id: 2
        }
    ];

    const typeOptions = [
        { value: "movie", label: "Movies" },
        { value: "tv", label: "Shows" }
    ];

    const stateOptions = [
        { value: "All", label: "All" },
        { value: "Completed", label: "Completed" }
    ];

    const pageData = Promise.resolve({
        items,
        page: 1,
        totalPages: 1,
        limit: 24,
        totalItems: items.length,
        typeOptions,
        stateOptions
    });

    const emptyPageData = Promise.resolve({
        items: [],
        page: 1,
        totalPages: 0,
        limit: 24,
        totalItems: 0,
        typeOptions,
        stateOptions
    });
</script>

<Story name="WithItems" args={{ data: { user, permissions, itemsSearchForm, pageData } }} />

<Story
    name="Empty"
    args={{ data: { user, permissions, itemsSearchForm, pageData: emptyPageData } }} />
