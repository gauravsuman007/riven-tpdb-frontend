import type {
    CustomProfile,
    PluginGroup,
    PluginInfo,
    SettingFieldDef,
    SetupData,
    SetupGeneralSection,
    SetupPluginCardView,
    SetupPluginSection,
    Step
} from "./types";

export type Shape =
    | "boolean"
    | "number"
    | "string"
    | "string_array"
    | "bool_object"
    | "number_object"
    | "custom_rank_object"
    | "settings_section"
    | "unknown";

export function stringifyPluginFields(settings: Record<string, unknown>): Record<string, string> {
    return Object.fromEntries(
        Object.entries(settings).map(([key, value]) => [key, value == null ? "" : String(value)])
    );
}

export function pluginStatus(plugin: PluginInfo): {
    label: string;
    variant: "default" | "secondary";
} {
    if (!plugin.enabled) return { label: "Inactive", variant: "secondary" };
    if (plugin.valid) return { label: "Active", variant: "default" };
    return { label: "Invalid", variant: "secondary" };
}

export const settingsSwitchClass =
    "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80 [&_[data-slot=switch-thumb]]:translate-x-0 [&_[data-state=checked][data-slot=switch-thumb]]:translate-x-[calc(100%-2px)] rtl:[&_[data-state=checked][data-slot=switch-thumb]]:-translate-x-[calc(100%-2px)] dark:[&_[data-state=unchecked][data-slot=switch-thumb]]:bg-foreground dark:[&_[data-state=checked][data-slot=switch-thumb]]:bg-primary-foreground";

export function detectShape(v: unknown): Shape {
    if (typeof v === "boolean") return "boolean";
    if (typeof v === "number") return "number";
    if (typeof v === "string") return "string";
    if (Array.isArray(v)) {
        if (v.every((x) => typeof x === "string")) return "string_array";
        return "unknown";
    }
    if (v !== null && typeof v === "object") {
        const entries = Object.entries(v as object);
        if (entries.every(([, val]) => typeof val === "boolean")) return "bool_object";
        if (entries.every(([, val]) => typeof val === "number")) return "number_object";
        if (
            entries.length > 0 &&
            entries.every(
                ([, val]) => val !== null && typeof val === "object" && "fetch" in (val as object)
            )
        ) {
            return "custom_rank_object";
        }
        return "settings_section";
    }
    return "unknown";
}

export function toLabel(key: string): string {
    return key
        .replace(/^r(\d+p)$/, "$1")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

const pluginGroups: PluginGroup[] = [
    {
        id: "media",
        title: "Media Servers",
        description: "Pick the server Riven should update after downloads finish.",
        emptyMessage: "No media-server style plugins were detected."
    },
    {
        id: "sources",
        title: "Content Sources",
        description: "Pick the sources Riven should scrape from.",
        emptyMessage: "No source-provider plugins were detected."
    },
    {
        id: "services",
        title: "Metadata and Requests",
        description: "Connect metadata, lists, calendars, and request services.",
        emptyMessage: "No metadata or request-service plugins were detected."
    }
];

const setupStepMeta = {
    welcome: {
        label: "Welcome",
        description: "Quick overview before you connect providers."
    },
    quality: {
        label: "Quality",
        description: "Choose profiles and instance defaults."
    },
    finish: {
        label: "Review",
        description: "Check readiness and finish setup."
    }
} satisfies Record<"welcome" | "quality" | "finish", Omit<Step, "id">>;

type SetupState = {
    general: Record<string, unknown>;
    customProfiles: CustomProfile[];
    pluginStates: Record<string, PluginInfo>;
};

type PluginUiState = {
    pluginFieldMap: Record<string, Record<string, string>>;
    pluginLoadingMap: Record<string, boolean>;
    pluginSavingMap: Record<string, boolean>;
    revealedFields: Record<string, Set<string>>;
};

export function createSetupState(data: SetupData): SetupState {
    return {
        general: { ...(data.generalSettings as Record<string, unknown>) },
        customProfiles: (data.customProfiles ?? []).map((profile) => ({ ...profile })),
        pluginStates: Object.fromEntries(
            (data.plugins ?? []).map((plugin) => [plugin.name, { ...plugin }])
        )
    };
}

function pluginText(plugin: PluginInfo) {
    return [
        plugin.name,
        ...plugin.schema.flatMap((field) => [
            field.key,
            field.label,
            field.description ?? "",
            field.placeholder ?? ""
        ])
    ]
        .join(" ")
        .toLowerCase();
}

function hasAny(text: string, patterns: RegExp[]) {
    return patterns.some((pattern) => pattern.test(text));
}

export function inferPluginGroup(plugin: PluginInfo): PluginGroup["id"] {
    const text = pluginText(plugin);
    const name = plugin.name.trim().toLowerCase();

    if (["torrentio", "comet", "stremthru"].includes(name)) return "sources";
    if (["plex", "emby", "jellyfin", "emby-jellyfin"].includes(name)) return "media";
    if (["tmdb", "tvdb", "trakt", "seerr", "mdblist", "listrr", "calendar"].includes(name)) {
        return "services";
    }

    if (
        hasAny(text, [
            /\bplex\b/,
            /\bemby\b/,
            /\bjellyfin\b/,
            /\blibrary\b/,
            /\bmedia server\b/,
            /\bserver url\b/
        ])
    ) {
        return "media";
    }

    if (
        hasAny(text, [
            /\bscrape\b/,
            /\bstream\b/,
            /\bprovider\b/,
            /\bfilter\b/,
            /\bdebrid\b/,
            /\btorrent\b/,
            /\bstrem/i
        ])
    ) {
        return "sources";
    }

    return "services";
}

export function buildPluginSections(
    pluginStates: Record<string, PluginInfo>,
    uiState: PluginUiState
): SetupPluginSection[] {
    const grouped = new Map<PluginGroup["id"], SetupPluginCardView[]>(
        pluginGroups.map((group) => [group.id, []])
    );

    for (const plugin of Object.values(pluginStates)) {
        const groupId = inferPluginGroup(plugin);
        grouped.get(groupId)?.push({
            plugin,
            badge: pluginStatus(plugin),
            fields: uiState.pluginFieldMap[plugin.name] ?? {},
            loading: uiState.pluginLoadingMap[plugin.name] ?? false,
            saving: uiState.pluginSavingMap[plugin.name] ?? false,
            reveals: uiState.revealedFields[plugin.name] ?? new Set<string>()
        });
    }

    return pluginGroups
        .map((group) => ({
            ...group,
            plugins: (grouped.get(group.id) ?? []).sort((a, b) =>
                a.plugin.name.localeCompare(b.plugin.name)
            )
        }))
        .filter((group) => group.plugins.length > 0);
}

function inferGeneralSection(field: SettingFieldDef) {
    const text = [field.key, field.label, field.description ?? ""].join(" ").toLowerCase();

    if (/\bbitrate\b/.test(text)) {
        return {
            title: "Bitrate Limits",
            description:
                "Optional bitrate guards to reject streams that are too small or too large."
        };
    }

    if (/\bretry\b|\bre-index\b|\bdelay\b|\bschedule\b|\bair date\b/.test(text)) {
        return {
            title: "Scheduling",
            description: "How often Riven retries work and how it revisits unreleased content."
        };
    }

    if (/\blanguage\b|\bdubbed\b|\baudio\b|\bsubtitle\b/.test(text)) {
        return {
            title: "Language",
            description: "Language defaults that influence which releases Riven will accept."
        };
    }

    if (/\bfilesystem\b|\bmount\b|\blibrary profile\b|\blibrary profiles\b/.test(text)) {
        return {
            title: "Filesystem",
            description: "Mount configuration and filtered virtual library views."
        };
    }

    return {
        title: "General Preferences",
        description: "Instance-wide defaults that shape Riven's runtime behaviour."
    };
}

export function buildGeneralSections(schema: SettingFieldDef[]): SetupGeneralSection[] {
    const sections = new Map<string, SetupGeneralSection>();

    for (const field of schema) {
        const meta = inferGeneralSection(field);
        const existing = sections.get(meta.title);

        if (existing) {
            existing.fields.push(field);
            continue;
        }

        sections.set(meta.title, {
            ...meta,
            fields: [field]
        });
    }

    return [...sections.values()];
}

export function buildSetupSteps(pluginSections: SetupPluginSection[]): Step[] {
    return [
        { id: "welcome", ...setupStepMeta.welcome },
        ...pluginSections.map((section) => ({
            id: section.id,
            label: section.title,
            description: section.description
        })),
        { id: "quality", ...setupStepMeta.quality },
        { id: "finish", ...setupStepMeta.finish }
    ];
}
