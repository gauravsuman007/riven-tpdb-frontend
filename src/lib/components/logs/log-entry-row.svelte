<script lang="ts">
    import type { LogEntry } from "$lib/stores/logs.svelte";

    let { log }: { log: LogEntry } = $props();

    const levelColors: Record<string, string> = {
        error: "text-red-400",
        warn: "text-yellow-400",
        info: "text-green-400",
        debug: "text-blue-400",
        trace: "text-muted-foreground"
    };
    const level = $derived((log.level ?? "info").toLowerCase());
</script>

<div class="border-border/50 hover:bg-muted/20 border-b transition-colors last:border-b-0">
    <div
        class="text-foreground/90 grid grid-cols-[auto_auto_auto_1fr] gap-x-3 p-2 font-mono text-xs">
        <span class="text-muted-foreground shrink-0">{log.timestamp ?? ""}</span>
        <span class="shrink-0 font-semibold uppercase {levelColors[level] ?? 'text-foreground'}"
            >{level}</span>
        <span class="text-muted-foreground/70 shrink-0">{log.target ?? ""}</span>
        <span class="wrap-break-word whitespace-pre-wrap">{log.message ?? ""}</span>
    </div>
</div>
