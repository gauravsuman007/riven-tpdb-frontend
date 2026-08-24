<!--
    The collections shelf on the library page.

    Collections are deliberately rendered as a single row of cards rather than
    as their contents: an award year holds several hundred entries, and the
    whole point of the collection model is that those entries do not appear in
    the library listing. The card shows counts so the year is legible at a
    glance, and links through to the collection's own page.
-->
<script lang="ts">
    import { resolve } from "$app/paths";
    import type { CollectionSummary } from "$lib/collections";
    import Trophy from "@lucide/svelte/icons/trophy";
    import ChevronRight from "@lucide/svelte/icons/chevron-right";

    interface Props {
        collections: CollectionSummary[];
    }

    let { collections }: Props = $props();
</script>

{#if collections.length}
    <section class="flex flex-col gap-4">
        <div class="flex items-end justify-between">
            <div class="space-y-1">
                <h2 class="font-serif text-2xl font-medium tracking-tight text-white/90">
                    Collections
                </h2>
                <div class="flex items-center gap-2 text-zinc-400">
                    <span class="font-mono text-xs tracking-widest uppercase">Curated</span>
                    <span class="h-px w-8 bg-zinc-700"></span>
                    <span class="font-mono text-xs text-zinc-400">
                        {collections.length} collections · not counted in the library
                    </span>
                </div>
            </div>
        </div>

        <ul class="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 [scrollbar-width:thin]">
            {#each collections as collection (collection.key)}
                <li class="flex min-w-[220px] snap-start">
                    <a
                        href={resolve(`/collections/${collection.key}`)}
                        class="group relative flex w-full flex-col justify-between gap-4 rounded-2xl border border-white/15 bg-zinc-900/60 p-4 transition-all hover:border-white/35 hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none">
                        <div class="flex items-start justify-between gap-2">
                            <div class="space-y-1">
                                <div class="flex items-center gap-2">
                                    <Trophy class="text-primary h-4 w-4" aria-hidden="true" />
                                    <span class="text-base font-medium text-white/90">
                                        {collection.name}
                                    </span>
                                </div>
                                <p class="font-mono text-xs text-zinc-400">
                                    {collection.winners.toLocaleString()} winners ·
                                    {collection.total.toLocaleString()} nominated
                                </p>
                            </div>
                            <ChevronRight
                                class="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-white/80"
                                aria-hidden="true" />
                        </div>

                        <!--
                        Two different denominators, and they matter: `matched` is
                        how many entries resolved to a TPDB title (so could be
                        requested at all), `requested` is how many are actually
                        in the library.
                    -->
                        <dl class="flex items-center gap-4 font-mono text-xs">
                            <div class="space-y-0.5">
                                <dt class="text-zinc-400">In library</dt>
                                <dd class="text-primary">
                                    {collection.requested.toLocaleString()}
                                </dd>
                            </div>
                            <div class="h-6 w-px bg-white/15"></div>
                            <div class="space-y-0.5">
                                <dt class="text-zinc-400">Matched</dt>
                                <dd class="text-white/80">
                                    {collection.matched.toLocaleString()}/{collection.total.toLocaleString()}
                                </dd>
                            </div>
                        </dl>
                    </a>
                </li>
            {/each}
        </ul>
    </section>
{/if}
