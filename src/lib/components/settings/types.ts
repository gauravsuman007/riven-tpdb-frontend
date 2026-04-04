export type QualityProfile = {
    id: string;
    label: string;
    description: string;
    settings: Record<string, unknown>;
};

export type CustomProfile = {
    id: number;
    name: string;
    settings: Record<string, unknown>;
    is_builtin: boolean;
    enabled: boolean;
    created_at: string;
    updated_at: string;
};

export type SettingFieldDef = {
    key: string;
    label: string;
    type: string;
    required: boolean;
    default_value?: string;
    placeholder?: string;
    description?: string;
};

export type PluginInfo = {
    name: string;
    version: string;
    enabled: boolean;
    valid: boolean;
    schema: SettingFieldDef[];
};

export type SetupData = {
    generalSettings: Record<string, unknown>;
    generalSettingsSchema: SettingFieldDef[];
    plugins: PluginInfo[];
    rankSettings: Record<string, unknown>;
    qualityProfiles: QualityProfile[];
    customProfiles: CustomProfile[];
    setupSummary: SetupSummary;
};

export type SetupPluginStatus = {
    name: string;
    version: string;
    enabled: boolean;
    valid: boolean;
    requiredFields: string[];
    missingRequiredFields: string[];
    configuredFieldCount: number;
};

export type SetupSummary = {
    pluginStatuses: SetupPluginStatus[];
    totalPlugins: number;
    enabledPlugins: number;
    validPlugins: number;
    pluginsMissingRequiredConfig: number;
    hasEnabledProfiles: boolean;
};

export type Step = {
    id: "welcome" | "media" | "sources" | "services" | "quality" | "finish";
    label: string;
    description: string;
};

export type PluginGroup = {
    id: "media" | "sources" | "services";
    title: string;
    description: string;
    emptyMessage: string;
};

export type SetupPluginCardView = {
    plugin: PluginInfo;
    badge: { label: string; variant: "default" | "secondary" };
    fields: Record<string, string>;
    loading: boolean;
    saving: boolean;
    reveals: Set<string>;
};

export type SetupPluginSection = PluginGroup & {
    plugins: SetupPluginCardView[];
};

export type SetupGeneralSection = {
    title: string;
    description: string;
    fields: SettingFieldDef[];
};

export type SetupProfileView = QualityProfile & {
    enabled: boolean;
};
