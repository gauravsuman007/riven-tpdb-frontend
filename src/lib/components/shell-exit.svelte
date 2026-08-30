<script lang="ts">
    /**
     * Back to the Jellyfin client's own server-selection screen.
     *
     * Only for a client pointed STRAIGHT at this app. Signing out lands on
     * the login page, which inside the WebView is a dead end: no address bar,
     * no back gesture out of the web content, and no other route to the
     * server list. The only escape was force-quitting the client.
     *
     * This used to also cover "behind jellyfin-client-multiplexer: back to
     * its app picker". It no longer does, and must not again: the
     * multiplexer now injects that button into every app's HTML on the way
     * out (see its inject.ts). One implementation, and unlike this one it
     * survives an error page -- a control rendered by the app is missing
     * exactly when the app has fallen over.
     *
     * Renders nothing in an ordinary browser, where the back button and the
     * address bar both already exist.
     */
    import { onMount } from "svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import ServerIcon from "@lucide/svelte/icons/server";

    interface Props {
        /** Rendered as a full button with a label rather than an icon. */
        labelled?: boolean;
        class?: string;
    }

    let { labelled = false, class: className = "" }: Props = $props();

    let mode = $state<"none" | "server-selection">("none");

    onMount(() => {
        const resolve = (): typeof mode =>
            window.RivenNative?.serverSelectionAvailable?.() ? "server-selection" : "none";

        mode = resolve();

        if (mode !== "none") return;

        /*
            Polled briefly rather than checked once.

            The bridge arrives from a `defer`red script, and there is no
            guaranteed ordering between that and hydration -- a single check,
            or a single retry frame, can land first and latch this to "none"
            for the whole session, which is exactly why the button could not
            be found. Polling for a couple of seconds costs nothing (a
            property read) and removes the race entirely rather than betting
            on winning it.
        */
        const started = Date.now();
        const timer = setInterval(() => {
            mode = resolve();

            if (mode !== "none" || Date.now() - started > 3000) clearInterval(timer);
        }, 150);

        return () => clearInterval(timer);
    });

    function leave() {
        window.RivenNative?.openServerSelection?.();
    }

    const label = "Change server";
</script>

{#if mode !== "none"}
    {#if labelled}
        <Button type="button" variant="outline" onclick={leave} class={className}>
            <ServerIcon class="mr-2 size-4" aria-hidden="true" />
            {label}
        </Button>
    {:else}
        <button
            type="button"
            onclick={leave}
            aria-label={label}
            class="hover:bg-accent/80 group relative flex h-10 w-10 items-center justify-center rounded-md transition-colors {className}">
            <ServerIcon class="size-5" aria-hidden="true" />
        </button>
    {/if}
{/if}
