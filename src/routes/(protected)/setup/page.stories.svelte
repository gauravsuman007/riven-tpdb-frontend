<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import SetupPage from "./+page.svelte";

    const { Story } = defineMeta({
        title: "pages/Setup",
        component: SetupPage,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen",
            docs: {
                description: {
                    component:
                        "Shows the wizard's initial Welcome step. Reaching the final Finish step fires a live `instanceStatus` query, which isn't exercised by this story."
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
            }
        ],
        values: { instance_name: "My Riven Instance" }
    };

    const pluginSections: SettingsSection[] = [
        {
            id: "real_debrid",
            title: "Real-Debrid",
            kind: "plugin",
            category: "downloaders",
            enabled: false,
            valid: false,
            configured: false,
            missingRequiredFields: ["api_key"],
            schema: [{ key: "api_key", label: "API Key", type: "password", required: true }],
            values: {}
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
        { key: "r1080p", label: "1080p", type: "custom_rank", required: false }
    ];

    const qualityProfiles: QualityProfile[] = [
        { id: "balanced", label: "Balanced", description: "A good mix.", settings: {} }
    ];

    const customProfiles: CustomProfile[] = [];

    const data = {
        user: { id: "1", name: "Alice", email: "alice@example.com" },
        permissions: getPermissionFlags("admin"),
        sections: [generalSection, ...pluginSections],
        rankSettings: { r1080p: { fetch: true, rank: 100 } },
        rankSettingsSchema,
        qualityProfiles,
        customProfiles,
        setupGroups,
        instanceStatus: {
            setupCompleted: false,
            readyToComplete: false,
            enabledValidPluginCount: 0,
            enabledProfileCount: 0,
            blockers: ["No downloader configured"]
        }
    };
</script>

<Story name="Welcome" args={{ data }} />
