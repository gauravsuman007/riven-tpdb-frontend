import type { CalendarDate } from "@internationalized/date";
import type { Component } from "svelte";

export interface EntertainmentItem {
    item_id: number;
    tvdb_id: string;
    tmdb_id: string;
    show_title: string;
    item_type: string;
    aired_at: string;
    season?: number;
    episode?: number;
    last_state?: string;
}

export interface CalendarDay {
    date: CalendarDate;
    dateKey: string;
    isCurrentMonth: boolean;
    items: EntertainmentItem[];
}

export interface FilterOption {
    id: string;
    label: string;
    type: string;
    icon: Component;
}
