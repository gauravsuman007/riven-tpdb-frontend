<script lang="ts">
    /**
     * A poster that shows it is working.
     *
     * Cards across the brochure, AVN, library and studio surfaces were a bare
     * dark box until the image arrived from a CDN. `loading="lazy"` was already
     * set, so the requests were fine -- what was missing was any sign that
     * something was happening, which is what made those pages read as slow even
     * when the JSON behind them answered in single-digit milliseconds.
     *
     * The shimmer sits BEHIND the image rather than the image being faded in
     * over it, and that is deliberate. Fading in on `onload` means the image
     * carries `opacity: 0` until JavaScript runs -- so on a server-rendered
     * page that has not hydrated, or on the `/tv` surface which sets
     * `csr = false` and never hydrates at all, the poster would be invisible
     * forever. Stacked this way the image is painted the moment it decodes,
     * with or without JS, and the placeholder is simply covered.
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
        something else would otherwise keep the previous image's "loaded" state
        and never show a placeholder for the new one.
    */
    $effect(() => {
        src;
        state = "loading";
    });
</script>

{#if state !== "failed"}
    {#if state !== "loaded"}
        <!-- Behind the image, not in front of it. See the note above. -->
        <Skeleton class="absolute inset-0 z-0 h-full w-full rounded-none" />
    {/if}

    <img
        {src}
        {alt}
        loading="lazy"
        decoding="async"
        onload={() => (state = "loaded")}
        onerror={() => (state = "failed")}
        class={cn("relative z-10 h-full w-full object-cover", className)} />
{:else if fallback}
    {@render fallback()}
{/if}
