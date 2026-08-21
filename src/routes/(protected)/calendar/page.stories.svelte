<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import CalendarPage from "./+page.svelte";

    const { Story } = defineMeta({
        title: "pages/Calendar",
        component: CalendarPage,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen"
        }
    });
</script>

<script lang="ts">
    import * as dateUtils from "$lib/utils/date";
    import { getPermissionFlags } from "$lib/permissions";

    const today = dateUtils.getToday();

    function isoDaysFromToday(offset: number) {
        return dateUtils.toISODate(dateUtils.addDays(today, offset));
    }

    const items = [
        {
            item_id: 1,
            tvdb_id: "1",
            tmdb_id: "94605",
            show_title: "Arcane",
            item_type: "episode",
            aired_at: isoDaysFromToday(0) as string | undefined,
            season: 2 as number | undefined,
            episode: 3 as number | undefined,
            last_state: "Completed"
        },
        {
            item_id: 2,
            tvdb_id: "2",
            tmdb_id: "603692",
            show_title: "John Wick: Chapter 4",
            item_type: "movie",
            aired_at: isoDaysFromToday(2) as string | undefined,
            season: undefined,
            episode: undefined,
            last_state: "Completed"
        },
        {
            item_id: 3,
            tvdb_id: "3",
            tmdb_id: "1399",
            show_title: "Game of Thrones",
            item_type: "show",
            aired_at: isoDaysFromToday(-3) as string | undefined,
            season: undefined,
            episode: undefined,
            last_state: "Completed"
        }
    ];

    const user = { id: "1", name: "Alice", email: "alice@example.com" };
    const permissions = getPermissionFlags("user");

    const data = { user, permissions, calendar: { data: items } };
    const emptyData = { user, permissions, calendar: { data: [] } };
</script>

<Story name="WithReleases" args={{ data }} />

<Story name="Empty" args={{ data: emptyData }} />
