import type { Actions, PageServerLoad } from "./$types";
import { error, fail } from "@sveltejs/kit";
import { gql } from "$lib/graphql-client";

const RANK_SETTINGS_QUERY = `query { rankSettings }`;
const UPDATE_RANK_SETTINGS = `mutation UpdateRankSettings($settings: JSON!) { updateRankSettings(settings: $settings) }`;

const GENERAL_SETTINGS_QUERY = `query { generalSettings }`;
const GENERAL_SETTINGS_SCHEMA_QUERY = `query { generalSettingsSchema }`;
const UPDATE_GENERAL_SETTINGS = `mutation UpdateGeneralSettings($settings: JSON!) { updateGeneralSettings(settings: $settings) }`;

const PLUGIN_INFO_QUERY = `
    query {
        pluginInfo {
            name
            version
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
    valid: boolean;
    schema: SettingFieldDef[];
};

export const load: PageServerLoad = async ({ fetch, locals }) => {
    try {
        const [rankData, generalData, generalSchemaData, pluginData] = await Promise.all([
            gql<{ rankSettings: Record<string, unknown> }>(
                locals.backendUrl,
                locals.apiKey,
                RANK_SETTINGS_QUERY,
                {},
                fetch
            ).catch(() => ({ rankSettings: {} })),
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

        return {
            rankSettings: rankData.rankSettings,
            generalSettings: generalData.generalSettings,
            generalSettingsSchema: generalSchemaData.generalSettingsSchema,
            plugins: pluginData.pluginInfo
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
            await gql(
                locals.backendUrl,
                locals.apiKey,
                UPDATE_GENERAL_SETTINGS,
                { settings },
                fetch
            );
            return { success: true };
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
            const result = await gql<{ updatePluginSettings: { settings: unknown; valid: boolean } }>(
                locals.backendUrl,
                locals.apiKey,
                UPDATE_PLUGIN_SETTINGS,
                { plugin, settings },
                fetch
            );
            return { success: true, valid: result.updatePluginSettings.valid };
        } catch {
            return fail(500, { error: "Failed to save plugin settings" });
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
