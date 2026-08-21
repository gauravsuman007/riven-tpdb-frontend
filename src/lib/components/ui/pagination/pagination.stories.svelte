<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import * as Pagination from "./index.js";

    const { Story } = defineMeta({
        title: "ui/Pagination",
        component: Pagination.Root,
        tags: ["autodocs"]
    });
</script>

<Story name="Default" asChild>
    <Pagination.Root count={120} perPage={10} page={4}>
        {#snippet children({ pages, currentPage })}
            <Pagination.Content>
                <Pagination.Item>
                    <Pagination.PrevButton />
                </Pagination.Item>
                {#each pages as page (page.key)}
                    {#if page.type === "ellipsis"}
                        <Pagination.Item><Pagination.Ellipsis /></Pagination.Item>
                    {:else}
                        <Pagination.Item>
                            <Pagination.Link {page} isActive={currentPage === page.value}>
                                {page.value}
                            </Pagination.Link>
                        </Pagination.Item>
                    {/if}
                {/each}
                <Pagination.Item>
                    <Pagination.NextButton />
                </Pagination.Item>
            </Pagination.Content>
        {/snippet}
    </Pagination.Root>
</Story>
