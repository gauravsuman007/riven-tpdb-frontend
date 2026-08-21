<script lang="ts">
    import Film from "@lucide/svelte/icons/film";
    import Tv from "@lucide/svelte/icons/tv";
    import { cn } from "$lib/utils";
    import { typeStyles, itemUrl } from "./helpers";
    import type { EntertainmentItem } from "./types";

    let {
        item,
        compact = false
    }: {
        item: EntertainmentItem;
        compact?: boolean;
    } = $props();

    const href = $derived(itemUrl(item));
    const style = $derived(typeStyles[item.item_type] ?? typeStyles.movie);
    const classes = $derived(
        cn(
            "group/item flex items-center rounded-md border transition-colors",
            compact ? "gap-1.5 truncate px-2 py-1" : "gap-3 p-2.5",
            style.item,
            item.last_state === "Completed" && "line-through opacity-60",
            href && "no-underline"
        )
    );
    const title = $derived(
        compact
            ? `${item.show_title}${item.season ? ` S${item.season}E${item.episode}` : ""}`
            : undefined
    );
</script>

{#snippet icon(size = 4)}
    {@const cls = `h-${size} w-${size} shrink-0 ${style.icon}`}
    {#if item.item_type === "movie"}
        <Film class={cls} />
    {:else}
        <Tv class={cls} />
    {/if}
{/snippet}

{#snippet content()}
    {#if !compact}
        {@render icon(4)}
    {/if}
    <div class="min-w-0 flex-1 leading-none">
        <div class={cn("min-w-0 text-xs", compact ? "truncate font-medium" : "font-semibold")}>
            {item.show_title}
            {#if item.season && compact}
                S{item.season}{#if item.episode}E{item.episode}{/if}
            {/if}
        </div>
        {#if item.season && !compact}
            <div class="text-muted-foreground text-xs">
                Season {item.season}{#if item.episode}, Episode {item.episode}{/if}
            </div>
        {/if}
    </div>
{/snippet}

{#if href}
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
    <a {href} class={classes} {title}>
        {#if compact}
            <span class={cn("size-1.5 shrink-0 rounded-full", style.dot)}></span>
        {/if}
        {@render content()}
    </a>
{:else}
    <div class={classes} {title}>
        {#if compact}
            <span class={cn("size-1.5 shrink-0 rounded-full", style.dot)}></span>
        {/if}
        {@render content()}
    </div>
{/if}
