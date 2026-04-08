import type { Actions, PageServerLoad } from "./$types";
import { error, fail } from "@sveltejs/kit";
import { gql } from "$lib/graphql-client";
import type {
    CustomProfile,
    PluginInfo,
    QualityProfile,
    SettingFieldDef,
    SetupPluginStatus,
    SetupSummary
} from "$lib/components/settings/types";

const RANK_SETTINGS_QUERY = `query { rankSettings qualityProfiles customProfiles }`;
const UPDATE_RANK_SETTINGS = `mutation UpdateRankSettings($settings: JSON!) { updateRankSettings(settings: $settings) }`;
const SAVE_CUSTOM_PROFILE = `mutation SaveCustomProfile($id: Int, $name: String!, $settings: JSON!, $enabled: Boolean) { saveCustomProfile(id: $id, name: $name, settings: $settings, enabled: $enabled) }`;
const DELETE_CUSTOM_PROFILE = `mutation DeleteCustomProfile($id: Int!) { deleteCustomProfile(id: $id) }`;
const SET_PROFILE_ENABLED = `mutation SetProfileEnabled($name: String!, $enabled: Boolean!) { setProfileEnabled(name: $name, enabled: $enabled) }`;
const UPDATE_PROFILE_SETTINGS = `mutation UpdateProfileSettings($name: String!, $settings: JSON!) { updateProfileSettings(name: $name, settings: $settings) }`;

const GENERAL_SETTINGS_QUERY = `query { generalSettings }`;
const GENERAL_SETTINGS_SCHEMA_QUERY = `query { generalSettingsSchema }`;
const UPDATE_GENERAL_SETTINGS = `mutation UpdateGeneralSettings($settings: JSON!) { updateGeneralSettings(settings: $settings) }`;

const PLUGIN_INFO_QUERY = `
    query {
        pluginInfo {
            name
            version
            enabled
            valid
            schema
        }
    }
`;

const PLUGIN_SETTINGS_QUERY = `
    query PluginSettings($plugin: String!) {
        pluginSettings(plugin: $plugin)
    }
`;

const UPDATE_PLUGIN_SETTINGS = `
    mutation UpdatePluginSettings($plugin: String!, $settings: JSON!) {
        updatePluginSettings(plugin: $plugin, settings: $settings)
    }
`;

export const load: PageServerLoad = async ({ fetch, locals }) => {
    try {
        const [rankData, generalData, generalSchemaData, pluginData] = await Promise.all([
            gql<{
                rankSettings: Record<string, unknown>;
                qualityProfiles: QualityProfile[];
                customProfiles: CustomProfile[];
            }>(locals.backendUrl, locals.apiKey, RANK_SETTINGS_QUERY, {}, fetch).catch(() => ({
                rankSettings: {},
                qualityProfiles: [],
                customProfiles: []
            })),
            gql<{ generalSettings: Record<string, unknown> }>(
                locals.backendUrl,
                locals.apiKey,
                GENERAL_SETTINGS_QUERY,
                {},
                fetch
            ).catch(() => ({ generalSettings: {} })),
            gql<{ generalSettingsSchema: SettingFieldDef[] }>(
                locals.backendUrl,
                locals.apiKey,
                GENERAL_SETTINGS_SCHEMA_QUERY,
                {},
                fetch
            ).catch(() => ({ generalSettingsSchema: [] })),
            gql<{ pluginInfo: PluginInfo[] }>(
                locals.backendUrl,
                locals.apiKey,
                PLUGIN_INFO_QUERY,
                {},
                fetch
            ).catch(() => ({ pluginInfo: [] }))
        ]);

        const pluginStatuses = (pluginData.pluginInfo ?? []).map((plugin) => {
            const requiredFields = (plugin.schema ?? [])
                .filter((field) => field.required)
                .map((field) => field.key);

            return {
                name: plugin.name,
                version: plugin.version,
                enabled: plugin.enabled,
                valid: plugin.valid,
                requiredFields,
                missingRequiredFields: [],
                configuredFieldCount: 0
            } satisfies SetupPluginStatus;
        });

        const setupSummary: SetupSummary = {
            pluginStatuses,
            totalPlugins: pluginStatuses.length,
            enabledPlugins: pluginStatuses.filter((plugin) => plugin.enabled).length,
            validPlugins: pluginStatuses.filter((plugin) => plugin.enabled && plugin.valid).length,
            pluginsMissingRequiredConfig: 0,
            hasEnabledProfiles: (rankData.customProfiles ?? []).some((profile) => profile.enabled)
        };

        return {
            rankSettings: rankData.rankSettings,
            qualityProfiles: rankData.qualityProfiles ?? [],
            customProfiles: rankData.customProfiles ?? [],
            generalSettings: generalData.generalSettings,
            generalSettingsSchema: generalSchemaData.generalSettingsSchema,
            plugins: pluginData.pluginInfo,
            setupSummary
        };
    } catch {
        error(500, "Failed to load settings");
    }
};

export const actions = {
    updateRanking: async ({ request, fetch, locals }) => {
        const formData = await request.formData();
        const rawSettings = formData.get("settings");
        if (!rawSettings || typeof rawSettings !== "string") {
            return fail(400, { error: "Settings data is required" });
        }
        let settings: unknown;
        try {
            settings = JSON.parse(rawSettings);
        } catch {
            return fail(400, { error: "Invalid JSON settings" });
        }
        try {
            await gql(locals.backendUrl, locals.apiKey, UPDATE_RANK_SETTINGS, { settings }, fetch);
            return { success: true };
        } catch {
            return fail(500, { error: "Failed to save ranking settings" });
        }
    },

    updateGeneral: async ({ request, fetch, locals }) => {
        const formData = await request.formData();
        const rawSettings = formData.get("settings");
        if (!rawSettings || typeof rawSettings !== "string") {
            return fail(400, { error: "Settings data is required" });
        }
        let settings: unknown;
        try {
            settings = JSON.parse(rawSettings);
        } catch {
            return fail(400, { error: "Invalid JSON settings" });
        }
        try {
            const result = await gql<{
                updateGeneralSettings: {
                    settings?: Record<string, unknown>;
                    filesystem_profile_rematch_count?: number;
                };
            }>(locals.backendUrl, locals.apiKey, UPDATE_GENERAL_SETTINGS, { settings }, fetch);
            return {
                success: true,
                updatedCount: result.updateGeneralSettings.filesystem_profile_rematch_count ?? 0
            };
        } catch {
            return fail(500, { error: "Failed to save general settings" });
        }
    },
    updatePlugin: async ({ request, fetch, locals }) => {
        const formData = await request.formData();
        const plugin = formData.get("plugin");
        const rawSettings = formData.get("settings");
        if (!plugin || typeof plugin !== "string") {
            return fail(400, { error: "Plugin name is required" });
        }
        if (!rawSettings || typeof rawSettings !== "string") {
            return fail(400, { error: "Settings data is required" });
        }
        let settings: unknown;
        try {
            settings = JSON.parse(rawSettings);
        } catch {
            return fail(400, { error: "Invalid JSON settings" });
        }
        try {
            const result = await gql<{
                updatePluginSettings: { settings: unknown; enabled: boolean; valid: boolean };
            }>(
                locals.backendUrl,
                locals.apiKey,
                UPDATE_PLUGIN_SETTINGS,
                { plugin, settings },
                fetch
            );
            return {
                success: true,
                enabled: result.updatePluginSettings.enabled,
                valid: result.updatePluginSettings.valid
            };
        } catch {
            return fail(500, { error: "Failed to save plugin settings" });
        }
    },

    saveCustomProfile: async ({ request, fetch, locals }) => {
        const formData = await request.formData();
        const rawId = formData.get("id");
        const name = formData.get("name");
        const rawSettings = formData.get("settings");
        if (!name || typeof name !== "string" || !name.trim()) {
            return fail(400, { error: "Profile name is required" });
        }
        if (!rawSettings || typeof rawSettings !== "string") {
            return fail(400, { error: "Settings data is required" });
        }
        let settings: unknown;
        try {
            settings = JSON.parse(rawSettings);
        } catch {
            return fail(400, { error: "Invalid JSON settings" });
        }
        const id = rawId && typeof rawId === "string" && rawId !== "" ? Number(rawId) : null;
        try {
            const result = await gql<{ saveCustomProfile: CustomProfile }>(
                locals.backendUrl,
                locals.apiKey,
                SAVE_CUSTOM_PROFILE,
                { id, name: name.trim(), settings },
                fetch
            );
            return { profile: result.saveCustomProfile };
        } catch {
            return fail(500, { error: "Failed to save profile" });
        }
    },

    deleteCustomProfile: async ({ request, fetch, locals }) => {
        const formData = await request.formData();
        const rawId = formData.get("id");
        if (!rawId || typeof rawId !== "string") {
            return fail(400, { error: "Profile ID is required" });
        }
        try {
            await gql(
                locals.backendUrl,
                locals.apiKey,
                DELETE_CUSTOM_PROFILE,
                { id: Number(rawId) },
                fetch
            );
            return { success: true, deletedId: Number(rawId) };
        } catch {
            return fail(500, { error: "Failed to delete profile" });
        }
    },

    setProfileEnabled: async ({ request, fetch, locals }) => {
        const formData = await request.formData();
        const name = formData.get("name");
        const enabled = formData.get("enabled");
        if (!name || typeof name !== "string") {
            return fail(400, { error: "Profile name is required" });
        }
        try {
            await gql(
                locals.backendUrl,
                locals.apiKey,
                SET_PROFILE_ENABLED,
                {
                    name,
                    enabled: enabled === "true"
                },
                fetch
            );
            return { success: true };
        } catch {
            return fail(500, { error: "Failed to update profile" });
        }
    },

    updateProfileSettings: async ({ request, fetch, locals }) => {
        const formData = await request.formData();
        const name = formData.get("name");
        const rawSettings = formData.get("settings");
        if (!name || typeof name !== "string") {
            return fail(400, { error: "Profile name is required" });
        }
        if (!rawSettings || typeof rawSettings !== "string") {
            return fail(400, { error: "Settings data is required" });
        }
        let settings: unknown;
        try {
            settings = JSON.parse(rawSettings);
        } catch {
            return fail(400, { error: "Invalid JSON settings" });
        }
        try {
            await gql(
                locals.backendUrl,
                locals.apiKey,
                UPDATE_PROFILE_SETTINGS,
                { name, settings },
                fetch
            );
            return { success: true };
        } catch {
            return fail(500, { error: "Failed to update profile settings" });
        }
    },

    loadPluginSettings: async ({ request, fetch, locals }) => {
        const formData = await request.formData();
        const plugin = formData.get("plugin");
        if (!plugin || typeof plugin !== "string") {
            return fail(400, { error: "Plugin name is required" });
        }
        try {
            const data = await gql<{ pluginSettings: Record<string, string> }>(
                locals.backendUrl,
                locals.apiKey,
                PLUGIN_SETTINGS_QUERY,
                { plugin },
                fetch
            );
            return { pluginSettings: data.pluginSettings ?? {}, plugin };
        } catch {
            return fail(500, { error: "Failed to load plugin settings" });
        }
    }
} satisfies Actions;
