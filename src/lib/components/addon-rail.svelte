<!--
    An add-on's row, drawn by the host.

    ONE RENDERER, ANY ADD-ON. The card shape is the same five fields the
    television's contract already uses -- an id, something to read, something
    to look at, and where it goes -- and that is deliberately all. The host
    cannot know what a performer or a chapter or a scene looks like in some
    add-on's vocabulary, and a row that needed to would mean a release of this
    app for every add-on anybody writes.

    A ROW WITH NOTHING TO SAY DRAWS NOTHING. Not a heading over an empty
    strip, not an error: an add-on's index may legitimately be empty for days
    after it is installed, and a heading over nothing reads as a broken
    feature rather than as one that has not filled up yet. The same applies to
    a request that fails -- the add-on may be mid-reload, and the rest of the
    page is not its business.

    EVERY STRING HERE IS UNTRUSTED. An add-on is third-party code installed
    from a git URL. Svelte escapes text for us; what it does not do is stop an
    `href` of `javascript:`, so links are checked below.
-->
<script lang="ts">
    import PosterImage from "$lib/components/media/poster-image.svelte";

    interface Card {
        id: string;
        title: string;
        subtitle?: string;
        image?: string | null;
        /** What pressing it does. Never a URL -- see below. */
        action?: string;
    }

    interface Props {
        title: string;
        endpoint: string;
        /** The add-on the row belongs to; half of every card's address. */
        addon: string;
        description?: string;
    }

    let { title, endpoint, addon, description }: Props = $props();

    let items = $state<Card[]>([]);

    /**
     * Where a card goes, built HERE rather than sent by the add-on.
     *
     * No card carries a URL, and that is a safety property as much as a
     * design one: an add-on is third-party code installed from a git URL, and
     * one that could name a link would be naming it on a page that carries
     * the viewer's session. The id is escaped into an address this app owns,
     * so the worst a hostile id can do is point at a page of the add-on's own
     * that does not exist.
     *
     * "play" has no meaning on a rail -- a row of cards is a way into
     * something, not a player -- so anything that is not "open" is inert.
     */
    function link(card: Card): string | undefined {
        if ((card.action ?? "open") !== "open") return undefined;

        return `/x/${encodeURIComponent(addon)}/${encodeURIComponent(card.id)}`;
    }

    $effect(() => {
        const from = endpoint;
        let stale = false;

        fetch(from)
            .then((response) => (response.ok ? response.json() : null))
            .then((body) => {
                if (stale) return;
                items = Array.isArray(body?.items) ? (body.items as Card[]) : [];
            })
            .catch(() => {
                if (!stale) items = [];
            });

        return () => {
            stale = true;
        };
    });
</script>

{#if items.length}
    <section class="flex flex-col gap-4">
        <div class="flex items-center gap-3">
            <div class="bg-primary h-6 w-1 rounded-full"></div>
            <div>
                <h2 class="text-foreground text-2xl font-bold tracking-tight drop-shadow-md">
                    {title}
                </h2>
                {#if description}
                    <p class="font-mono text-xs text-zinc-400">{description}</p>
                {/if}
            </div>
        </div>

        <ul class="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:thin]">
            {#each items as card (card.id)}
                <li class="w-[130px] shrink-0 snap-start md:w-[150px]">
                    <svelte:element
                        this={link(card) ? "a" : "div"}
                        href={link(card)}
                        class="group flex flex-col gap-2 focus-visible:outline-none">
                        <div
                            class="relative aspect-square overflow-hidden rounded-full border border-white/15 bg-zinc-900 transition-all group-hover:border-white/40">
                            {#if card.image}
                                <PosterImage src={card.image} alt={card.title}>
                                    {#snippet fallback()}
                                        <div
                                            class="flex h-full items-center justify-center p-2 text-center font-mono text-xs text-zinc-500">
                                            {card.title}
                                        </div>
                                    {/snippet}
                                </PosterImage>
                            {:else}
                                <div
                                    class="flex h-full items-center justify-center p-2 text-center font-mono text-xs text-zinc-500">
                                    {card.title}
                                </div>
                            {/if}
                        </div>
                        <div class="space-y-0.5 text-center">
                            <p class="truncate text-sm text-white/90">{card.title}</p>
                            {#if card.subtitle}
                                <p class="truncate font-mono text-xs text-zinc-400">
                                    {card.subtitle}
                                </p>
                            {/if}
                        </div>
                    </svelte:element>
                </li>
            {/each}
        </ul>
    </section>
{/if}
