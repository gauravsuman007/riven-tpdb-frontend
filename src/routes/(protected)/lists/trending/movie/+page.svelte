<script lang="ts">
    import { getContext } from "svelte";
    import { SearchStore } from "$lib/services/search-store.svelte";
    import { FilterStore } from "$lib/services/filter-store.svelte";
    import TrendingDiscoveryPage from "$lib/components/media/trending-discovery-page.svelte";

    let searchStore = getContext<SearchStore>("searchStore");
    let filterStore = getContext<FilterStore>("filterStore");
</script>

<TrendingDiscoveryPage
    mediaType="movie"
    title="Trending Movies"
    emptyMessage="No movies found"
    {searchStore}
    {filterStore} />
