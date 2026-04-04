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
