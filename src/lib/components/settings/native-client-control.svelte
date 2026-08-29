<script lang="ts">
    /**
     * Entry point to the Jellyfin shell's OWN settings screen.
     *
     * These preferences (which video player to use, gesture options, buffer
     * sizes) are native, per-device, and stored inside the Android app -- they
     * have no server-side representation, so this server cannot read or set
     * them. What jellyfin-android does expose is
     * `NativeShell.openClientSettings()`, which opens that screen; our bridge
     * script forwards it as `RivenNative.openSettings()`.
     *
     * Renders nothing in a normal browser, where none of it exists.
     */
    import { onMount } from "svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import SettingsIcon from "@lucide/svelte/icons/settings-2";

    // Resolved on mount rather than inline: the bridge is injected by a
    // deferred script, so it can be absent for the first render even inside
    // the shell.
    let available = $state(false);

    onMount(() => {
        available = window.RivenNative?.settingsAvailable() ?? false;

        // The bridge script is deferred, so on a cold load straight to this
        // page hydration can beat it and latch `available` to false for good.
        // One re-check on the next frame is enough -- the same race made the
        // player's external-player button disappear permanently.
        if (!available) {
            requestAnimationFrame(() => {
                available = window.RivenNative?.settingsAvailable() ?? false;
            });
        }
    });
</script>

{#if available}
    <div
        class="border-border/60 bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
        <div class="min-w-0">
            <p class="text-sm font-medium">Player and app settings</p>
            <p class="text-muted-foreground text-xs">
                Choose the integrated player, an external app like VLC, or this page's own
                player. Stored on this device, not on the server.
            </p>
        </div>
        <Button variant="outline" onclick={() => window.RivenNative?.openSettings()}>
            <SettingsIcon class="mr-2 size-4" />
            Open app settings
        </Button>
    </div>
{/if}
