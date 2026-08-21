<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import CalendarDayCell from "./calendar-day-cell.svelte";

    const { Story } = defineMeta({
        title: "calendar/CalendarDayCell",
        component: CalendarDayCell,
        tags: ["autodocs"]
    });
</script>

<script lang="ts">
    import { CalendarDate } from "@internationalized/date";
    import type { CalendarDay } from "./types";

    const busyDay: CalendarDay = {
        date: new CalendarDate(2024, 6, 12),
        dateKey: "2024-06-12",
        isCurrentMonth: true,
        items: [
            {
                item_id: 1,
                tvdb_id: "",
                tmdb_id: "603692",
                show_title: "John Wick: Chapter 4",
                item_type: "movie",
                aired_at: "2024-06-12"
            },
            {
                item_id: 2,
                tvdb_id: "121361",
                tmdb_id: "1399",
                show_title: "Game of Thrones",
                item_type: "episode",
                aired_at: "2024-06-12",
                season: 8,
                episode: 1
            },
            {
                item_id: 3,
                tvdb_id: "371572",
                tmdb_id: "94605",
                show_title: "Arcane",
                item_type: "show",
                aired_at: "2024-06-12"
            },
            {
                item_id: 4,
                tvdb_id: "82856",
                tmdb_id: "1418",
                show_title: "The Big Bang Theory",
                item_type: "episode",
                aired_at: "2024-06-12",
                season: 5,
                episode: 12
            }
        ]
    };

    const emptyDay: CalendarDay = {
        date: new CalendarDate(2024, 6, 15),
        dateKey: "2024-06-15",
        isCurrentMonth: true,
        items: []
    };

    const outsideMonthDay: CalendarDay = {
        ...emptyDay,
        date: new CalendarDate(2024, 5, 30),
        dateKey: "2024-05-30",
        isCurrentMonth: false
    };
</script>

<Story name="Busy" asChild>
    <div class="w-40">
        <CalendarDayCell day={busyDay} isToday={false} />
    </div>
</Story>

<Story name="Today" asChild>
    <div class="w-40">
        <CalendarDayCell day={busyDay} isToday />
    </div>
</Story>

<Story name="Empty" asChild>
    <div class="w-40">
        <CalendarDayCell day={emptyDay} isToday={false} />
    </div>
</Story>

<Story name="OutsideMonth" asChild>
    <div class="w-40">
        <CalendarDayCell day={outsideMonthDay} isToday={false} />
    </div>
</Story>
