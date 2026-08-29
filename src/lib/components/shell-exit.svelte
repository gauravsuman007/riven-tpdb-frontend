<script lang="ts">
    /**
     * The way out of this app when it is running inside a client that has no
     * address bar.
     *
     * Two situations, one control, because to the user they are the same
     * thing -- "leave this app":
     *
     *   - behind jellyfin-client-multiplexer: back to its app picker
     *   - pointed straight at this app from the Jellyfin client: back to the
     *     client's own server-selection screen
     *
     * The second case is why this exists at all. Signing out lands on the
     * login page, which inside the WebView is a dead end: no address bar, no
     * back gesture out of the web content, and no other route to the server
     * list. The only escape was force-quitting the client.
     *
     * Renders nothing in an ordinary browser, where the back button and the
     * address bar both already exist.
     */
    import { onMount } from "svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import GridIcon from "@lucide/svelte/icons/layout-grid";
    import ServerIcon from "@lucide/svelte/icons/server";

    interface Props {
        /** Rendered as a full button with a label rather than an icon. */
        labelled?: boolean;
        class?: string;
    }

    let { labelled = false, class: className = "" }: Props = $props();

    let mode = $state<"none" | "multiplexer" | "server-selection">("none");

    onMount(() => {
        const resolve = (): typeof mode => {
            if (document.documentElement.dataset.multiplexer === "1") return "multiplexer";
            if (window.RivenNative?.serverSelectionAvailable?.()) return "server-selection";
            return "none";
        };

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
        if (mode === "multiplexer") {
            window.location.href = "/apps";
            return;
        }

        window.RivenNative?.openServerSelection?.();
    }

    const label = $derived(mode === "multiplexer" ? "Switch app" : "Change server");
</script>

{#if mode !== "none"}
    {#if labelled}
        <Button type="button" variant="outline" onclick={leave} class={className}>
            {#if mode === "multiplexer"}
                <GridIcon class="mr-2 size-4" aria-hidden="true" />
            {:else}
                <ServerIcon class="mr-2 size-4" aria-hidden="true" />
            {/if}
            {label}
        </Button>
    {:else}
        <button
            type="button"
            onclick={leave}
            aria-label={label}
            class="hover:bg-accent/80 group relative flex h-10 w-10 items-center justify-center rounded-md transition-colors {className}">
            {#if mode === "multiplexer"}
                <GridIcon class="size-5" aria-hidden="true" />
            {:else}
                <ServerIcon class="size-5" aria-hidden="true" />
            {/if}
        </button>
    {/if}
{/if}
