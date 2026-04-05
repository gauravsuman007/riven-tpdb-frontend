export type DashboardStatistics = {
    total_movies: number;
    total_shows: number;
    total_seasons: number;
    total_episodes: number;
    total_items: number;
    incomplete_items: number;
    states: Record<string, number>;
    activity: Record<string, number>;
    media_year_releases: { year: number; count: number }[];
};

export type DownloaderService = {
    service: string;
    email: string | null;
    username: string | null;
    premium_status: string | null;
    premium_expires_at: string | null;
    premium_days_left: number | null;
    points: number | null;
    total_downloaded_bytes: number | null;
    cooldown_until: string | null;
};

export type ActivePlaybackSession = {
    server: string;
    userName: string | null;
    parentTitle: string | null;
    itemTitle: string;
    itemType: string | null;
    seasonNumber: number | null;
    episodeNumber: number | null;
    playbackState: string;
    playbackMethod: string;
    positionSeconds: number | null;
    durationSeconds: number | null;
    deviceName: string | null;
    clientName: string | null;
    imageUrl: string | null;
};
