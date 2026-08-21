<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import SettingsPage from "./+page.svelte";

    const { Story } = defineMeta({
        title: "pages/Settings",
        component: SettingsPage,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen",
            docs: {
                description: {
                    component:
                        "Save buttons and ranking-profile actions call the real `gqlClient` — inert here since nothing is clicked, matching the scope of the individual tab stories."
                }
            }
        }
    });
</script>

<script lang="ts">
    import type {
        CustomProfile,
        QualityProfile,
        SettingFieldDef,
        SettingsSection,
        SetupGroup
    } from "$lib/components/settings/types";
    import { getPermissionFlags } from "$lib/permissions";

    const generalSection: SettingsSection = {
        id: "general",
        title: "General",
        kind: "general",
        missingRequiredFields: [],
        schema: [
            {
                key: "instance_name",
                label: "Instance Name",
                type: "string",
                required: true,
                section: "Instance"
            },
            {
                key: "log_level",
                label: "Log Level",
                type: "string",
                required: false,
                section: "Instance",
                options: ["debug", "info", "warn", "error"]
            }
        ],
        values: {
            instance_name: "My Riven Instance",
            log_level: "info"
        }
    };

    const pluginSections: SettingsSection[] = [
        {
            id: "real_debrid",
            title: "Real-Debrid",
            kind: "plugin",
            category: "downloaders",
            enabled: true,
            valid: true,
            configured: true,
            missingRequiredFields: [],
            schema: [{ key: "api_key", label: "API Key", type: "password", required: true }],
            values: { api_key: "s3cr3t" }
        }
    ];

    const setupGroups: SetupGroup[] = [
        {
            id: "downloaders",
            title: "Downloaders",
            description: "Fetch media from your debrid service."
        }
    ];

    const rankSettingsSchema: SettingFieldDef[] = [
        { key: "r1080p", label: "1080p", type: "custom_rank", required: false },
        { key: "r2160p", label: "2160p", type: "custom_rank", required: false }
    ];

    const qualityProfiles: QualityProfile[] = [
        { id: "balanced", label: "Balanced", description: "A good mix.", settings: {} }
    ];

    const customProfiles: CustomProfile[] = [
        {
            id: 1,
            name: "My Custom Profile",
            settings: {},
            is_builtin: false,
            enabled: true,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-06-01T00:00:00Z"
        }
    ];

    const user = { id: "1", name: "Alice", email: "alice@example.com" };

    const data = {
        user,
        permissions: getPermissionFlags("admin"),
        sections: [generalSection, ...pluginSections],
        rankSettings: { r1080p: { fetch: true, rank: 100 }, r2160p: { fetch: false, rank: 50 } },
        rankSettingsSchema,
        initialProfileName: null,
        qualityProfiles,
        customProfiles,
        setupGroups,
        instanceStatus: {
            setupCompleted: true,
            readyToComplete: true,
            enabledValidPluginCount: 1,
            enabledProfileCount: 1,
            blockers: []
        }
    };
</script>

<Story
    name="Admin"
    args={{ data }}
    parameters={{
        sveltekit_experimental: {
            state: { page: { data: { permissions: { canManageSettings: true } } } }
        }
    }} />

<Story
    name="NonAdmin"
    args={{ data }}
    parameters={{
        sveltekit_experimental: {
            state: { page: { data: { permissions: { canManageSettings: false } } } }
        }
    }} />
