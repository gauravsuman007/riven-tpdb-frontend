<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import CalendarMobileDayCard from "./calendar-mobile-day-card.svelte";

    const { Story } = defineMeta({
        title: "calendar/CalendarMobileDayCard",
        component: CalendarMobileDayCard,
        tags: ["autodocs"]
    });
</script>

<script lang="ts">
    import { CalendarDate } from "@internationalized/date";
    import type { CalendarDay } from "./types";

    const day: CalendarDay = {
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
            }
        ]
    };
</script>

<Story name="Default" asChild>
    <div class="w-80">
        <CalendarMobileDayCard {day} isToday={false} />
    </div>
</Story>

<Story name="Today" asChild>
    <div class="w-80">
        <CalendarMobileDayCard {day} isToday />
    </div>
</Story>
