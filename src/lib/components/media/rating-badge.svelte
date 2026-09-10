<!--
    An audience rating, out of five.

    Renders nothing at all when there is no rating, which is the whole point of
    routing every caller through here. Two different sources write a rating and
    both have an "absent" value that is easy to mistake for a real score:

    * TPDB stores a literal **0** on every record -- it exposes no ranking, so
      0 means "no ranking", not "rated zero". 60 of the library's 68 items hold
      that 0.
    * Adult Empire simply omits the field for a title nobody has reviewed.

    A card that showed "0.0" for the first case would be stating a fact the
    catalogue does not have.
-->
<script lang="ts">
    import StarIcon from "@lucide/svelte/icons/star";
    import { cn } from "$lib/utils";

    interface Props {
        rating?: number | null;
        /** `sm` for a card's meta line, `md` for a detail header. */
        size?: "sm" | "md";
        class?: string;
    }

    let { rating = null, size = "sm", class: className = "" }: Props = $props();

    // Number(): the backend serialises some ratings as strings.
    let value = $derived(rating === null || rating === undefined ? null : Number(rating));
    let shown = $derived(value !== null && Number.isFinite(value) && value > 0 ? value : null);
</script>

{#if shown !== null}
    <span
        class={cn(
            "inline-flex shrink-0 items-center gap-1 font-mono tabular-nums",
            size === "sm" ? "text-xs" : "text-sm",
            className
        )}
        title={`${shown.toFixed(2)} out of 5`}>
        <StarIcon
            class={cn("fill-amber-400 text-amber-400", size === "sm" ? "size-3" : "size-4")}
            aria-hidden="true" />
        {shown.toFixed(1)}
    </span>
{/if}
