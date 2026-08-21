<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import CollectionSheet from "./collection-sheet.svelte";

    const { Story } = defineMeta({
        title: "media/CollectionSheet",
        component: CollectionSheet,
        tags: ["autodocs"],
        parameters: {
            docs: {
                description: {
                    component:
                        "The sheet's `open` state is internal (not a prop), so this story shows the closed trigger button. Opening it fires a live `Collection` GraphQL query — not exercised here."
                }
            }
        },
        args: {
            collectionId: 10,
            collectionName: "John Wick Collection"
        }
    });
</script>

<Story name="Default" />
