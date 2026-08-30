<script lang="ts">
    /*
        `@` resets to the root layout, deliberately: the (protected) layout
        pulls in app.css (Tailwind v4) and the app-lock guard, and neither
        survives a browser this old -- Tailwind's `@layer` wrapper is dropped
        whole below Chromium 99, and the guard is client-side JS that never
        runs here.

        Every style in this section is therefore hand-written and limited to
        what Chromium 53 actually implements. In particular: NO CSS Grid (57),
        NO flexbox `gap` (84), NO `:is()`/`:where()` (88), NO `clamp()`/
        `min()` (79), NO `aspect-ratio` (88), NO `oklch()`/`color-mix()`
        (111), NO `position: sticky` (56), NO `dvh`. Cards are laid out with
        `inline-block` and margins, which has worked since IE8.
    */

    import "./tv-base.css";

    let { children } = $props();
</script>

<svelte:head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<div class="tv">
    {@render children()}
</div>

<style>
    .tv {
        /* Overscan. TV panels crop the outer few percent of the picture. */
        padding: 3vh 4vw;
        min-height: 100vh;
        box-sizing: border-box;
        font-size: 20px;
        line-height: 1.45;
    }
</style>
