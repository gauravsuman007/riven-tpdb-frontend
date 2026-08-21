<script lang="ts">
    import type { LiveLogLine } from "$lib/stores/logs.svelte";

    let { line }: { line: LiveLogLine } = $props();
</script>

<div class="border-border/50 hover:bg-muted/20 border-b transition-colors last:border-b-0">
    <div class="text-foreground/90 p-2 font-mono text-xs wrap-break-word whitespace-pre-wrap">
        {line}
    </div>
</div>
