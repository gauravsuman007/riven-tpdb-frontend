<script lang="ts">
    import "../../../(protected)/tv/tv-base.css";

    let { data, form } = $props();
</script>

<svelte:head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sign in</title>
</svelte:head>

<div class="tv">
    <h1>Sign in</h1>

    {#if data.enabled}
        <!-- No use:enhance: a native POST is the whole point of this page. -->
        <form method="POST">
            <label class="row" for="tv-username">Username</label>
            <input
                class="field"
                id="tv-username"
                name="username"
                autocapitalize="none"
                autocorrect="off"
                value={form?.username ?? ""}
            />

            <label class="row" for="tv-password">Password</label>
            <input class="field" id="tv-password" name="password" type="password" />

            {#if form?.error}<p class="error">{form.error}</p>{/if}

            <p><button class="go" type="submit">Sign in</button></p>
        </form>
    {:else}
        <p class="error">Password sign-in is disabled on this server.</p>
    {/if}
</div>

<style>
    /* Classes only, never descendant elements -- see the note on the browse page. */
    .tv {
        padding: 3vh 4vw;
        min-height: 100vh;
        box-sizing: border-box;
        font-size: 20px;
        line-height: 1.45;
    }

    h1 { margin: 0 0 3vh; font-size: 1.8em; font-weight: 600; }

    .row { display: block; margin: 0 0 .4em; color: #a1a1aa; font-size: .85em; }

    .field {
        display: block; width: 18em; max-width: 70vw; margin: 0 0 2.5vh;
        padding: .55em .7em; border: 2px solid #3f3f46; border-radius: 8px;
        background: #17171b; color: #f4f4f5; font: inherit;
    }

    .go {
        padding: .55em 1.6em; border: 0; border-radius: 8px;
        background: #4f46e5; color: #fff; font: inherit; cursor: pointer;
    }

    .error { color: #fca5a5; }
</style>
