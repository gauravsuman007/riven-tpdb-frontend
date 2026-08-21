<script lang="ts">
    import { setContext } from "svelte";
    import { SearchStore } from "$lib/services/search-store.svelte";
    import { FilterStore } from "$lib/services/filter-store.svelte";
    import TrendingDiscoveryPage from "$lib/components/media/trending-discovery-page.svelte";

    let searchStore = new SearchStore();
    let filterStore = new FilterStore();

    // Provide stores to children (like FilterPopover)
    setContext("searchStore", searchStore);
    setContext("filterStore", filterStore);
</script>

<TrendingDiscoveryPage
    mediaType="tv"
    title="Trending TV Shows"
    emptyMessage="No shows found"
    {searchStore}
    {filterStore} />
