<script lang="ts">
    /*
        One row of "things that are not titles" in search results: studios,
        OnlyFans accounts, and whatever else earns a row later.

        A ROW, not a grid. These are a handful of exact-ish answers sitting
        above a long list of titles, and a grid of twelve studios would push
        the films most searches actually want below the fold. Horizontal
        scroll keeps the row one screen tall however many match.

        Deliberately generic: it takes a label and a list of {href, title,
        subtitle, image, round}. The caller maps its own shape onto that, so
        adding a third kind of entity needs no change here.
    */
    export interface EntityItem {
        /*
            A plain string, not a resolved route. An OnlyFans account's page
            is `/x/<addon>/<handle>` and the add-on key is only known at
            runtime, so it can never be a member of SvelteKit's generated
            union of literal routes -- the same reason `addon-rail.svelte`
            builds its links by hand.
        */
        href: string;
        title: string;
        subtitle?: string | null;
        image?: string | null;
        /** Avatars are round, logos are not. */
        round?: boolean;
    }

    let {
        label,
        items,
        empty = ""
    }: { label: string; items: EntityItem[]; empty?: string } = $props();

    /** Initials, for the many studios and accounts that carry no artwork. */
    function initials(name: string): string {
        return (name || "?")
            .split(/\s+/)
            .slice(0, 2)
            .map((word) => word[0] ?? "")
            .join("")
            .toUpperCase();
    }
</script>

{#if items.length > 0}
    <section class="mx-auto w-full max-w-5xl py-4">
        <h2 class="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">
            {label}
        </h2>

        <!--
            overflow-x on the scroller alone, with the page's own gutter kept
            outside it: a row that scrolls must still start and end flush with
            everything above it.
        -->
        <div class="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
            {#each items as item (item.href)}
                <a
                    href={item.href}
                    class="border-border/50 bg-card/40 hover:border-border hover:bg-card group flex w-36 shrink-0 snap-start flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors">
                    {#if item.image}
                        <img
                            src={item.image}
                            alt=""
                            loading="lazy"
                            class="bg-muted h-16 w-16 object-contain {item.round
                                ? 'rounded-full object-cover'
                                : 'rounded-md'}" />
                    {:else}
                        <div
                            class="bg-muted text-muted-foreground flex h-16 w-16 items-center justify-center rounded-full text-sm font-semibold">
                            {initials(item.title)}
                        </div>
                    {/if}

                    <span class="text-foreground line-clamp-2 text-sm leading-tight font-medium">
                        {item.title}
                    </span>

                    {#if item.subtitle}
                        <span class="text-muted-foreground line-clamp-1 text-xs">
                            {item.subtitle}
                        </span>
                    {/if}
                </a>
            {/each}
        </div>
    </section>
{:else if empty}
    <p class="text-muted-foreground mx-auto w-full max-w-5xl py-2 text-sm">{empty}</p>
{/if}
