<script lang="ts">
    import { cn } from "$lib/utils";
    import DayItemsList from "./day-items-list.svelte";
    import { formatDayTitle } from "./helpers";
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
        "bg-card/80 border-border rounded-md border p-3",
        isToday && "border-primary/70 bg-primary/5"
    )}>
    <div class="mb-3 flex items-center justify-between">
        <div class={cn("text-lg font-semibold", isToday && "text-primary")}>
            {formatDayTitle(day.date)}
        </div>
        <div class="text-muted-foreground text-sm">
            {day.items.length} item{day.items.length !== 1 ? "s" : ""}
        </div>
    </div>
    <DayItemsList {day} />
</div>
