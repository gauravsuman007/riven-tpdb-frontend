<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import WatchingNowCard from "./watching-now-card.svelte";

    const { Story } = defineMeta({
        title: "dashboard/WatchingNowCard",
        component: WatchingNowCard,
        tags: ["autodocs"]
    });
</script>

<script lang="ts">
    import type { ActivePlaybackSession } from "./types";

    const sessions: ActivePlaybackSession[] = [
        {
            server: "Plex",
            userName: "alice",
            parentTitle: "Arcane",
            itemTitle: "The Base Violence Necessary for Change",
            itemType: "episode",
            seasonNumber: 2,
            episodeNumber: 5,
            playbackState: "playing",
            playbackMethod: "Direct Play",
            positionSeconds: 842,
            durationSeconds: 1620,
            deviceName: "Living Room TV",
            clientName: "Plex for Android TV",
            imageUrl: null
        },
        {
            server: "Plex",
            userName: "bob",
            parentTitle: null,
            itemTitle: "Dune: Part Two",
            itemType: "movie",
            seasonNumber: null,
            episodeNumber: null,
            playbackState: "paused",
            playbackMethod: "Transcode",
            positionSeconds: 3600,
            durationSeconds: 10260,
            deviceName: "iPhone",
            clientName: "Plex for iOS",
            imageUrl: null
        }
    ];
</script>

<Story name="Default" args={{ sessions }} />

<Story name="Empty" args={{ sessions: [] }} />
