<script lang="ts">
    import { cn } from "$lib/utils";
    import DayItemsList from "./day-items-list.svelte";
    import type { CalendarDay } from "./types";

    let {
        day,
        isToday
    }: {
        day: CalendarDay;
        isToday: boolean;
    } = $props();
</script>

<div
    class={cn(
        "group/day min-h-32 rounded-md border p-2 transition-colors",
        day.isCurrentMonth
            ? "bg-background/50 border-border/70 hover:border-primary/30 hover:bg-accent/30"
            : "bg-muted/10 border-border/30 text-muted-foreground/60",
        day.items.length > 0 && day.isCurrentMonth && "bg-card/80",
        isToday && "border-primary/70 bg-primary/5"
    )}>
    <div class="mb-2 flex items-start justify-between gap-2">
        <div
            class={cn(
                "flex size-7 items-center justify-center rounded-md text-sm font-semibold",
                isToday
                    ? "bg-primary text-primary-foreground"
                    : day.isCurrentMonth
                      ? "text-foreground"
                      : "text-muted-foreground/70"
            )}>
            {day.date.day}
        </div>
        {#if day.items.length > 0}
            <span
                class="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                {day.items.length}
            </span>
        {/if}
    </div>
    <DayItemsList {day} limit={3} showMore />
</div>
