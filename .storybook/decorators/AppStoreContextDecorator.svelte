<script lang="ts">
    import { setContext } from "svelte";
    import type { Snippet } from "svelte";
    import { SidebarStore, isMobileStore } from "$lib/stores/global.svelte";
    import { SearchStore } from "$lib/services/search-store.svelte";
    import { FilterStore } from "$lib/services/filter-store.svelte";

    let { children }: { children: Snippet } = $props();

    setContext("sidebarStore", SidebarStore);
    setContext("ismobilestore", isMobileStore);
    setContext("searchStore", new SearchStore());
    setContext("filterStore", new FilterStore());
</script>

{@render children()}
