import type {
    CustomProfile,
    PluginGroup,
    QualityProfile,
    SettingFieldDef,
    SetupSummary,
    Step
} from "./types";

export type SetupData = {
    generalSettings: Record<string, unknown>;
    generalSettingsSchema: SettingFieldDef[];
    plugins: import("./types").PluginInfo[];
    rankSettings: Record<string, unknown>;
    qualityProfiles: QualityProfile[];
    customProfiles: CustomProfile[];
    setupSummary: SetupSummary;
};

export const setupSteps: Step[] = [
    {
        id: "welcome",
        label: "Welcome",
        description: "Confirm what setup covers before you start wiring providers."
    },
    {
        id: "media",
        label: "Media Servers",
        description: "Connect Plex, Emby, or Jellyfin first so Riven knows your library targets."
    },
    {
        id: "sources",
        label: "Content Sources",
        description: "Enable the stream providers you actually plan to scrape from."
    },
    {
        id: "services",
        label: "Metadata & Requests",
        description: "Connect the discovery, metadata, and request services that round out the stack."
    },
    {
        id: "quality",
        label: "Quality",
        description:
            "Choose the playback profiles and default runtime preferences for this instance."
    },
    {
        id: "finish",
        label: "Review",
        description: "Check readiness, then finish onboarding and enter the app."
    }
];

export const mediaPluginGroup: PluginGroup = {
    title: "Media Servers",
    description:
        "These plugins connect Riven to the servers you already use to watch and organise media.",
    names: ["plex", "emby-jellyfin", "emby", "jellyfin"],
    emptyMessage: "No media-server plugins are registered in this instance."
};

export const sourcePluginGroup: PluginGroup = {
    title: "Content Sources",
    description: "These providers supply the candidate streams that Riven indexes and ranks.",
    names: ["torrentio", "comet", "stremthru"],
    emptyMessage: "No source plugins are registered in this instance."
};

export const servicePluginGroup: PluginGroup = {
    title: "Metadata, Discovery, and Requests",
    description: "These services enrich metadata, watchlists, discovery, and request workflows.",
    names: ["tmdb", "tvdb", "trakt", "seerr", "mdblist", "listrr", "calendar"],
    emptyMessage: "No metadata/request plugins are registered in this instance."
};

export const generalSections = [
    {
        title: "Language",
        description: "Language preferences that affect what Riven will fetch by default.",
        keys: ["dubbed_anime_only"]
    },
    {
        title: "Scheduling",
        description: "How often Riven retries and when unreleased content gets re-indexed.",
        keys: ["retry_interval_secs", "schedule_offset_minutes", "unknown_air_date_offset_days"]
    },
    {
        title: "Bitrate Limits",
        description: "Optional bitrate guards to stop very small encodes or oversized files.",
        keys: [
            "minimum_average_bitrate_movies",
            "minimum_average_bitrate_episodes",
            "maximum_average_bitrate_movies",
            "maximum_average_bitrate_episodes"
        ]
    }
];
