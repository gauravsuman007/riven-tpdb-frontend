<script lang="ts">
    import { ModeWatcher } from "mode-watcher";
    import type { Snippet } from "svelte";

    let { children }: { children: Snippet } = $props();
</script>

<ModeWatcher defaultMode="dark" defaultTheme="darkmatter" />
{@render children()}
