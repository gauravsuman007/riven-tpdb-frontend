<!--
    One line saying how this purpose's traffic is being routed, and the
    escape hatch when it can't be.

    Three states, and they are genuinely different situations, not shades of
    one message:
      - not routed at all -- plain network traffic, a caution rather than a
        problem
      - routed and connected -- the good case, named so the user can confirm
        it's actually happening rather than trust a checkbox from memory
      - routed but not connected -- the broken case. Nothing in this state
        should look like it might still work, which is why the caller is
        expected to disable its own controls when `blocked` is true; this
        component only supplies the message and the way out.
-->
<script lang="ts">
    import { Button } from "$lib/components/ui/button/index.js";
    import { disableRoute, type RouteState } from "$lib/vpn";
    import AlertTriangleIcon from "@lucide/svelte/icons/triangle-alert";
    import CircleIcon from "@lucide/svelte/icons/circle";

    interface Props {
        purpose: "scraping" | "streaming";
        route: RouteState;
        /** "Searching" / "Streaming" -- used for the connected and unrouted lines. */
        gerund: string;
        /** "Search" / "Stream" -- used for the blocked message and its button. */
        base: string;
        /** Streaming's banner reads larger; scraping's sits under a button. */
        size?: "sm" | "lg";
        onDisabled?: () => void;
    }

    let { purpose, route, gerund, base, size = "sm", onDisabled }: Props = $props();

    let disabling = $state(false);

    async function handleDisable() {
        disabling = true;
        const ok = await disableRoute(purpose);
        disabling = false;
        if (ok) onDisabled?.();
    }

    const textClass = $derived(size === "lg" ? "text-sm" : "text-xs");
</script>

{#if route.blocked}
    <div class="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
        <p class={`flex items-center gap-1.5 font-medium text-amber-500 ${textClass}`}>
            <AlertTriangleIcon class="size-4 shrink-0" aria-hidden="true" />
            {base} via VPN is selected, but the connection doesn't exist.
        </p>
        <div>
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabling}
                onclick={handleDisable}>
                <AlertTriangleIcon class="mr-2 size-4" aria-hidden="true" />
                {base} through my own network instead
            </Button>
        </div>
    </div>
{:else if route.routed}
    <p class={`flex items-center gap-1.5 text-emerald-500 ${textClass}`}>
        <CircleIcon class="size-2 shrink-0 fill-emerald-500 text-emerald-500" aria-hidden="true" />
        {gerund} through VPN{route.exitNodeName ? ` (${route.exitNodeName})` : ""}
    </p>
{:else}
    <p class={`text-muted-foreground flex items-center gap-1.5 ${textClass}`}>
        <AlertTriangleIcon class="size-3.5 shrink-0 text-amber-500" aria-hidden="true" />
        {gerund} through your own network
    </p>
{/if}
