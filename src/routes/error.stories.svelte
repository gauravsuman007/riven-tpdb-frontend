<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import ErrorPage from "./+error.svelte";

    const { Story } = defineMeta({
        title: "pages/ErrorPage",
        component: ErrorPage,
        tags: ["autodocs"],
        parameters: {
            docs: {
                description: {
                    component:
                        "SvelteKit's root `+error.svelte` boundary. Title/detail copy is driven entirely by `page.status`/`page.error`, mocked per-story via `parameters.sveltekit_experimental.state.page`."
                }
            }
        }
    });
</script>

<Story
    name="NotFound"
    parameters={{
        sveltekit_experimental: {
            state: { page: { status: 404, error: { message: "Not found" } } }
        }
    }} />

<Story
    name="Forbidden"
    parameters={{
        sveltekit_experimental: {
            state: { page: { status: 403, error: { message: "Forbidden" } } }
        }
    }} />

<Story
    name="ServerError"
    parameters={{
        sveltekit_experimental: {
            state: {
                page: {
                    status: 500,
                    error: { message: "Unable to connect to the Riven backend." }
                }
            }
        }
    }} />

<Story
    name="BadRequest"
    parameters={{
        sveltekit_experimental: {
            state: { page: { status: 400, error: { message: "Invalid media id" } } }
        }
    }} />
