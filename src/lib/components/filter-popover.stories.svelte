<script module lang="ts">
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import FilterPopover from "./filter-popover.svelte";
    import AppStoreContextDecorator from "$lib/storybook/decorators/AppStoreContextDecorator.svelte";
    import { fn } from "storybook/test";

    const { Story } = defineMeta({
        title: "components/FilterPopover",
        component: FilterPopover,
        tags: ["autodocs"],
        // `FilterPopover`'s own `Props` interface makes svelte-check treat this
        // decorator's generated prop type as unrelated to the one `defineMeta`
        // expects here; the cast is type-level-only, verified to render correctly.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        decorators: [() => ({ Component: AppStoreContextDecorator as any })],
        parameters: {
            docs: {
                description: {
                    component:
                        "Requires `filterStore` and `searchStore` context — it throws without them, so this story wraps it in the same decorator used for header/sidebar/mobile-nav."
                }
            }
        },
        args: {
            onApply: fn()
        }
    });
</script>

<Story name="Default" />
