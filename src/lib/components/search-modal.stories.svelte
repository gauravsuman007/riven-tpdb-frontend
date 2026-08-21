<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import SearchModal from "./search-modal.svelte";
    import { fn } from "storybook/test";

    const { Story } = defineMeta({
        title: "components/SearchModal",
        component: SearchModal,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen",
            sveltekit_experimental: {
                navigation: {
                    afterNavigate: { type: "enter" }
                }
            },
            docs: {
                description: {
                    component:
                        "Only the closed state is storied — the open state debounces user input into a live `SearchTmdb` GraphQL query, which isn't exercised here."
                }
            }
        },
        args: {
            onclose: fn(),
            onopen: fn()
        }
    });
</script>

<Story name="Closed" args={{ open: false }} />
