<script lang="ts">
    /**
     * One title rendered as a horizontal row: poster, title, meta, description.
     *
     * Shared by the related-titles list on a detail page and by search results.
     * A row has the width to show a description, which a poster grid does not,
     * and that description is usually what tells adult titles apart -- their
     * posters and names are frequently near-identical.
     */
    import { describeState, stateBadge } from "$lib/utils/item-state";
    import { openPlayer } from "$lib/stores/player.svelte";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import PlayIcon from "@lucide/svelte/icons/play";
    import { cn } from "$lib/utils";

    interface RowItem {
        id?: string | number;
        tpdb_uuid?: string | null;
        title?: string;
        poster_path?: string | null;
        overview?: string | null;
        year?: number | string | null;
        site_name?: string | null;
        performers?: string[] | null;
        media_type?: string;
        indexer?: string;
        riven_id?: number | null;
        state?: string | null;
    }

    let { item, href }: { item: RowItem; href: string } = $props();

    const status = $derived(item.state ? describeState(item.state) : null);
    const badge = $derived(stateBadge(item.state));
    const canPlay = $derived(!!item.riven_id && !!status?.available);

    const meta = $derived(
        [item.site_name, item.year && item.year !== "N/A" ? item.year : null]
            .filter(Boolean)
            .join(" · ")
    );
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<a
    {href}
    class="group hover:bg-accent/40 relative flex items-start gap-4 rounded-lg p-3 transition-colors">
    <div class="bg-muted relative h-28 w-20 shrink-0 overflow-hidden rounded-md sm:h-32 sm:w-24">
        {#if item.poster_path}
            <img
                src={item.poster_path}
                alt={item.title}
                loading="lazy"
                class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        {/if}

        {#if canPlay}
            <button
                type="button"
                onclick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openPlayer(item.riven_id, item.title ?? "");
                }}
                aria-label={`Play ${item.title}`}
                class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100">
                <span
                    class="flex size-9 items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/30">
                    <PlayIcon class="ml-0.5 size-4 fill-current" />
                </span>
            </button>
        {/if}
    </div>

    <div class="flex min-w-0 flex-col gap-1 py-0.5">
        <div class="flex items-start gap-2">
            <span class="text-foreground line-clamp-2 text-base leading-snug font-semibold">
                {item.title}
            </span>

            {#if badge}
                <Badge
                    variant="secondary"
                    class={cn(
                        "mt-0.5 shrink-0 text-[10px]",
                        badge.variant === "success" && "bg-green-600/25 text-green-300",
                        badge.variant === "error" && "bg-red-600/25 text-red-300"
                    )}>{badge.text}</Badge>
            {/if}
        </div>

        {#if meta}
            <span class="text-muted-foreground text-xs">{meta}</span>
        {/if}

        {#if item.performers?.length}
            <span class="text-primary/90 line-clamp-1 text-sm">
                {item.performers.join(", ")}
            </span>
        {/if}

        {#if item.overview}
            <!--
                Four lines. Two was not enough to tell adult titles apart, which
                is the whole job of this row.
            -->
            <p class="text-muted-foreground line-clamp-4 text-sm leading-relaxed">
                {item.overview}
            </p>
        {/if}
    </div>
</a>
