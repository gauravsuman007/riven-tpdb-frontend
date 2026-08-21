<script lang="ts">
    import { setContext } from "svelte";
    import type { Snippet } from "svelte";
    import { SidebarStore, isMobileStore } from "$lib/stores/global.svelte";
    import { SearchStore } from "$lib/services/search-store.svelte";
    import { FilterStore } from "$lib/services/filter-store.svelte";

    // Optional so `() => ({ Component: AppStoreContextDecorator })` type-checks when
    // used in a story's `decorators` array — Storybook's DecoratorHandler always
    // supplies children via normal slotting at runtime regardless of this type.
    let { children }: { children?: Snippet } = $props();

    setContext("sidebarStore", SidebarStore);
    setContext("ismobilestore", isMobileStore);
    setContext("searchStore", new SearchStore());
    setContext("filterStore", new FilterStore());
</script>

{@render children?.()}
