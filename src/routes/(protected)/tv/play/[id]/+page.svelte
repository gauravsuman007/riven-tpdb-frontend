<script lang="ts">
    let { data } = $props();
</script>

<svelte:head><title>{data.title || "Play"}</title></svelte:head>

<p class="back"><a href="/tv">&lsaquo; Back to the library</a></p>

{#if data.ready}
    <h1>{data.title}</h1>
    <!--
        The browser's own controls, on purpose. A custom transport bar is
        JavaScript, and this whole section ships none; webOS also gives its
        native control bar remote focus for free, which a hand-built one
        would have to reimplement.

        No `autoplay`: TV browsers routinely refuse it, and a refused
        autoplay looks identical to a broken stream. A focused play button
        is one remote press and always works.
    -->
    <!-- svelte-ignore a11y_media_has_caption -->
    <video src={data.src} controls preload="metadata" tabindex="0"></video>
{:else}
    {#if data.title}<h1>{data.title}</h1>{/if}
    <p class="notice">{data.reason}</p>
{/if}

<style>
    .back { margin: 0 0 2vh; }
    .back a { color: #a5b4fc; text-decoration: none; }

    h1 { margin: 0 0 2vh; font-size: 1.6em; font-weight: 600; }

    video {
        display: block;
        width: 100%;
        /* Not aspect-ratio (Chromium 88) -- a viewport height instead. */
        height: 74vh;
        background: #000;
        border-radius: 10px;
    }

    .notice { color: #a1a1aa; }
</style>
