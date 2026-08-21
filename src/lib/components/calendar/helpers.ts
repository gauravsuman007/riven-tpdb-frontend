import type { CalendarDate } from "@internationalized/date";
import { resolve } from "$app/paths";
import { getDayOfWeek } from "$lib/utils/date";
import type { EntertainmentItem } from "./types";

export const typeStyles: Record<string, { item: string; icon: string; dot: string }> = {
    movie: {
        item: "border-orange-500/30 bg-orange-500/20 text-orange-300 hover:bg-orange-500/30",
        icon: "text-orange-400",
        dot: "bg-orange-400"
    },
    episode: {
        item: "border-blue-500/30 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30",
        icon: "text-blue-400",
        dot: "bg-blue-400"
    },
    show: {
        item: "border-purple-500/30 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30",
        icon: "text-purple-400",
        dot: "bg-purple-400"
    },
    season: {
        item: "border-green-500/30 bg-green-500/20 text-green-300 hover:bg-green-500/30",
        icon: "text-green-400",
        dot: "bg-green-400"
    }
};

export function itemUrl(item: EntertainmentItem): string | undefined {
    const mediaType = item.item_type === "movie" ? "movie" : "tv";
    if (mediaType === "tv") {
        // For TV items, prefer TVDB ID to skip TMDB→TVDB resolution
        if (item.tvdb_id)
            return resolve(`/details/media/${item.tvdb_id}/${mediaType}?indexer=tvdb`);
        if (item.tmdb_id) return resolve(`/details/media/${item.tmdb_id}/${mediaType}`);
    } else {
        // For movies, prefer TMDB ID
        if (item.tmdb_id) return resolve(`/details/media/${item.tmdb_id}/${mediaType}`);
        if (item.tvdb_id)
            return resolve(`/details/media/${item.tvdb_id}/${mediaType}?indexer=tvdb`);
    }
    return undefined;
}

export const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
];
export const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDayTitle(date: CalendarDate) {
    return `${dayNames[getDayOfWeek(date)]}, ${monthNames[date.month - 1]} ${date.day}`;
}
