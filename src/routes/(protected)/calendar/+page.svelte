<script lang="ts">
    import { Button } from "$lib/components/ui/button/index.js";
    import ChevronLeft from "@lucide/svelte/icons/chevron-left";
    import ChevronRight from "@lucide/svelte/icons/chevron-right";
    import Film from "@lucide/svelte/icons/film";
    import Tv from "@lucide/svelte/icons/tv";
    import type { PageData } from "./$types";
    import { IsMobile } from "$lib/hooks/is-mobile.svelte";
    import * as dateUtils from "$lib/utils/date";
    import { CalendarDate } from "@internationalized/date";
    import PageShell from "$lib/components/page-shell.svelte";
    import CalendarDayCell from "$lib/components/calendar/calendar-day-cell.svelte";
    import CalendarMobileDayCard from "$lib/components/calendar/calendar-mobile-day-card.svelte";
    import TypeFilterChips from "$lib/components/calendar/type-filter-chips.svelte";
    import { monthNames, dayNames } from "$lib/components/calendar/helpers";
    import type { EntertainmentItem, CalendarDay } from "$lib/components/calendar/types";

    let { data }: { data: PageData } = $props();
    const isMobile = $state(new IsMobile(1280));

    const filterOptions = [
        { id: "movies", label: "Movies", type: "movie", icon: Film },
        { id: "episodes", label: "Episodes", type: "episode", icon: Tv },
        { id: "shows", label: "Shows", type: "show", icon: Tv },
        { id: "seasons", label: "Seasons", type: "season", icon: Tv }
    ];

    const today = dateUtils.getToday();
    const todayKey = dateUtils.toISODate(today);
    let currentDate = $state<CalendarDate>(today);
    let filters = $state<Record<string, boolean>>({
        movie: true,
        episode: true,
        show: true,
        season: true
    });

    const itemsByDate = $derived.by(() => {
        const items = data.calendar?.data
            ? (Object.values(data.calendar.data) as unknown as EntertainmentItem[])
            : [];

        const result: Record<string, EntertainmentItem[]> = {};
        for (const item of items) {
            if (!item?.aired_at) continue;
            const date = dateUtils.parseISODate(item.aired_at);
            if (!date) continue;
            const dateKey = dateUtils.toISODate(date);
            (result[dateKey] ??= []).push(item);
        }
        return result;
    });

    const filteredItemsByDate = $derived.by(() => {
        const result: Record<string, EntertainmentItem[]> = {};
        for (const [dateKey, items] of Object.entries(itemsByDate)) {
            result[dateKey] = items.filter((item) => filters[item.item_type] !== false);
        }
        return result;
    });

    const calendarDays: CalendarDay[] = $derived.by(() => {
        const { year, month } = currentDate;
        const firstDay = dateUtils.getFirstDayOfMonth(year, month);
        const lastDay = dateUtils.getLastDayOfMonth(year, month);
        const startOffset = dateUtils.getDayOfWeek(firstDay);
        const totalDays = startOffset + lastDay.day + (6 - dateUtils.getDayOfWeek(lastDay));
        const daysToShow = Math.ceil(totalDays / 7) * 7;

        const days: CalendarDay[] = [];
        for (let i = 0; i < daysToShow; i++) {
            const currentDay = dateUtils.addDays(firstDay, i - startOffset);
            const dateKey = dateUtils.toISODate(currentDay);
            days.push({
                date: currentDay,
                dateKey,
                isCurrentMonth: currentDay.month === month,
                items: filteredItemsByDate[dateKey] ?? []
            });
        }
        return days;
    });

    const currentMonthDays = $derived(calendarDays.filter((day) => day.isCurrentMonth));
    const visibleMonthDays = $derived(currentMonthDays.filter((day) => day.items.length > 0));

    function navigateMonth(direction: "prev" | "next") {
        const delta = direction === "prev" ? -1 : 1;
        let newMonth = currentDate.month + delta;
        let newYear = currentDate.year;
        if (newMonth < 1) {
            newMonth = 12;
            newYear--;
        } else if (newMonth > 12) {
            newMonth = 1;
            newYear++;
        }
        currentDate = new CalendarDate(newYear, newMonth, 1);
    }
</script>

<svelte:head>
    <title>Calendar - Riven</title>
</svelte:head>

<PageShell class="mx-auto h-full w-full max-w-[1800px] gap-5">
    <header
        class="border-border/60 flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
        <h1 class="truncate text-3xl font-bold tracking-tight">
            {monthNames[currentDate.month - 1]}
            {currentDate.year}
        </h1>

        <div class="flex items-center gap-2">
            <Button
                variant="outline"
                size="icon-sm"
                aria-label="Previous month"
                onclick={() => navigateMonth("prev")}>
                <ChevronLeft class="h-4 w-4" />
            </Button>
            <Button
                variant="outline"
                size="icon-sm"
                aria-label="Next month"
                onclick={() => navigateMonth("next")}>
                <ChevronRight class="h-4 w-4" />
            </Button>
        </div>
    </header>

    <TypeFilterChips options={filterOptions} bind:filters />

    <section class="border-border/60 bg-card/30 overflow-hidden rounded-md border">
        <div class="p-2 md:p-3">
            {#if isMobile.current}
                {#if visibleMonthDays.length > 0}
                    <div class="space-y-2">
                        {#each visibleMonthDays as day (day.dateKey)}
                            <CalendarMobileDayCard {day} isToday={day.dateKey === todayKey} />
                        {/each}
                    </div>
                {:else}
                    <div
                        class="border-border bg-background/40 text-muted-foreground rounded-md border border-dashed p-8 text-center">
                        No releases match the current filters for this month.
                    </div>
                {/if}
            {:else}
                <div
                    class="border-border/70 bg-border/70 grid grid-cols-7 gap-px overflow-hidden rounded-md border">
                    {#each dayNames as day (day)}
                        <div
                            class="bg-muted/40 text-muted-foreground px-3 py-2 text-center text-xs font-bold uppercase">
                            {day}
                        </div>
                    {/each}
                    {#each calendarDays as day (day.dateKey)}
                        <CalendarDayCell {day} isToday={day.dateKey === todayKey} />
                    {/each}
                </div>
            {/if}
        </div>
    </section>
</PageShell>
