<script lang="ts">
    import type { Snippet } from "svelte";

    let {
        tone = "zinc",
        image
    }: {
        /** "zinc" matches the raw dark backdrop used on media/discovery pages; "background" ties the gradient to the active theme's `--background` token (used on the entity page). */
        tone?: "zinc" | "background";
        /** Renders the backdrop `<img>` itself, so each caller keeps control over its own enter transition. */
        image: Snippet;
    } = $props();
</script>

<div class="fixed top-0 left-0 z-0 h-screen w-full transition-opacity duration-1000">
    {@render image()}
    <div class="bg-background/80 absolute inset-0 mix-blend-multiply"></div>
    {#if tone === "background"}
        <div
            class="from-background via-background/50 absolute inset-0 bg-linear-to-t to-transparent">
        </div>
        <div
            class="from-background/20 absolute inset-0 bg-linear-to-b via-transparent to-transparent">
        </div>
    {:else}
        <div class="absolute inset-0 bg-linear-to-t from-zinc-950 via-zinc-950/50 to-transparent">
        </div>
        <div
            class="absolute inset-0 bg-linear-to-b from-zinc-950/20 via-transparent to-transparent">
        </div>
    {/if}
</div>
