<script lang="ts">
    let { data } = $props();

    /* A form GET, so search needs no JavaScript at all. */
    function pageHref(page: number): string {
        const params = new URLSearchParams();
        if (data.search) params.set("q", data.search);
        if (page > 1) params.set("page", String(page));
        const query = params.toString();
        return query ? `/tv?${query}` : "/tv";
    }
</script>

<svelte:head><title>Library on TV</title></svelte:head>

<header class="head">
    <h1>Library</h1>
    <form class="search" method="GET" action="/tv">
        <input class="field" type="search" name="q" value={data.search} placeholder="Search" aria-label="Search the library" />
        <button class="go" type="submit">Search</button>
    </form>
</header>

{#if data.items.length === 0}
    <p class="empty">
        {data.search ? `Nothing matching “${data.search}”.` : "The library is empty."}
    </p>
{:else}
    <div class="shelf">
        {#each data.items as item (item.id)}
            <a class="card" href="/tv/play/{item.id}?t={encodeURIComponent(item.title)}">
                <span class="poster">
                    {#if item.poster}
                        <img class="pimg" src={item.poster} alt="" loading="lazy" />
                    {:else}
                        <span class="noposter">{item.title.slice(0, 1)}</span>
                    {/if}
                </span>
                <span class="title">{item.title}</span>
                <span class="meta">
                    {item.year ?? ""}{item.year && item.state ? " · " : ""}{item.state ?? ""}
                </span>
            </a>
        {/each}
    </div>

    {#if data.totalPages > 1}
        <nav class="pager">
            {#if data.page > 1}<a class="step" href={pageHref(data.page - 1)}>&lsaquo; Previous</a>{/if}
            <span class="of">Page {data.page} of {data.totalPages}</span>
            {#if data.page < data.totalPages}<a class="step" href={pageHref(data.page + 1)}>Next &rsaquo;</a>{/if}
        </nav>
    {/if}
{/if}

<style>
    .head { margin-bottom: 2.5vh; }
    h1 { margin: 0 0 1.5vh; font-size: 2em; font-weight: 600; }

    /*
        Every rule in this section targets a CLASS, never a descendant
        element. Svelte scopes `.search input` as
        `.search.svelte-x input:where(.svelte-x)`, and `:where()` is Chromium
        88 -- so on the target engine those rules are discarded exactly like
        the `:global()` ones were. Measured: it cost the search box, the
        search button, the poster image sizing and the pager links.
    */
    .field {
        width: 22em; max-width: 60vw; padding: .5em .7em;
        border: 2px solid #3f3f46; border-radius: 8px;
        background: #17171b; color: #f4f4f5; font: inherit;
    }
    .go {
        padding: .5em 1.2em; margin-left: .6em;
        border: 0; border-radius: 8px; background: #4f46e5;
        color: #fff; font: inherit; cursor: pointer;
    }

    /*
        inline-block cards rather than grid or flex: CSS Grid is Chromium 57
        and flexbox `gap` is 84, and this section exists precisely because the
        target engine is 53. Margins do the spacing, which has worked
        everywhere since long before either.
    */
    .shelf { font-size: 0; }

    .card {
        display: inline-block; vertical-align: top;
        width: 15vw; min-width: 150px; margin: 0 1.6vw 3vh 0;
        font-size: 20px; text-decoration: none; color: inherit;
    }

    .poster {
        display: block; width: 100%; height: 22vw; min-height: 220px;
        overflow: hidden; border-radius: 10px; background: #17171b;
        border: 1px solid #27272a;
    }
    .pimg { width: 100%; height: 100%; object-fit: cover; display: block; }

    .noposter {
        display: block; width: 100%; height: 100%; line-height: 22vw;
        text-align: center; font-size: 3em; color: #52525b;
    }

    .title {
        display: block; margin-top: .5em; font-size: .85em; font-weight: 600;
        /* No line-clamp: it needs -webkit-box plumbing that is fragile here. */
        overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
    }
    .meta { display: block; font-size: .72em; color: #a1a1aa; }

    .empty { color: #a1a1aa; }

    .pager { margin-top: 2vh; }
    .step { color: #a5b4fc; text-decoration: none; margin-right: 1.5em; }
    .of { color: #71717a; font-size: .85em; margin-right: 1.5em; }
</style>
