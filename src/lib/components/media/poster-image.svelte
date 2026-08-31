<script lang="ts">
    /**
     * A poster that shows it is working.
     *
     * Every card in the brochure and AVN sections was a bare dark box until
     * its image arrived from the CDN. `loading="lazy"` was already set, so the
     * requests were fine -- what was missing was any sign that something was
     * happening, which is what made those pages read as slow even when the
     * JSON behind them answered in single-digit milliseconds.
     *
     * A shimmer sits behind the image and is removed once it decodes, so the
     * card is never empty and never reflows: the placeholder occupies the
     * frame the image will fill.
     */
    import { Skeleton } from "$lib/components/ui/skeleton/index.js";
    import { cn } from "$lib/utils";

    let {
        src,
        alt,
        class: className,
        fallback
    }: {
        src: string;
        alt: string;
        class?: string;
        /** Shown when the image fails, in place of a broken-image glyph. */
        fallback?: import("svelte").Snippet;
    } = $props();

    let state = $state<"loading" | "loaded" | "failed">("loading");

    /*
        Reset when the src changes: a card recycled by an {#each} keyed on
        something else would otherwise keep the previous image's "loaded"
        state and never show a placeholder for the new one.
    */
    $effect(() => {
        src;
        state = "loading";
    });
</script>

{#if state !== "failed"}
    {#if state === "loading"}
        <Skeleton class="absolute inset-0 h-full w-full rounded-none" />
    {/if}

    <img
        {src}
        {alt}
        loading="lazy"
        decoding="async"
        onload={() => (state = "loaded")}
        onerror={() => (state = "failed")}
        class={cn(
            "h-full w-full object-cover transition-opacity duration-300",
            state === "loaded" ? "opacity-100" : "opacity-0",
            className
        )} />
{:else if fallback}
    {@render fallback()}
{/if}
