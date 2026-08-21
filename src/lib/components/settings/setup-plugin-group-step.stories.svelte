<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import SetupPluginGroupStep from "./setup-plugin-group-step.svelte";
    import { fn } from "storybook/test";

    const { Story } = defineMeta({
        title: "settings/SetupPluginGroupStep",
        component: SetupPluginGroupStep,
        tags: ["autodocs"],
        args: {
            savePlugin: fn()
        }
    });
</script>

<script lang="ts">
    import type { SetupPluginSection, SettingsSection } from "./types";

    function makeSection(
        id: string,
        title: string,
        enabled: boolean,
        valid: boolean
    ): SettingsSection {
        return {
            id,
            title,
            kind: "plugin",
            enabled,
            valid,
            configured: enabled,
            missingRequiredFields: [],
            schema: [
                { key: "api_key", label: "API Key", type: "password", required: true },
                { key: "enabled", label: "Enabled", type: "boolean", required: false }
            ],
            values: { api_key: enabled ? "s3cr3t" : "", enabled }
        };
    }

    const section: SetupPluginSection = {
        id: "downloaders",
        title: "Downloaders",
        description: "Configure at least one downloader to fetch media.",
        plugins: [
            {
                section: makeSection("real_debrid", "Real-Debrid", true, true),
                badge: { label: "Active", variant: "default" },
                saving: false
            },
            {
                section: makeSection("alldebrid", "AllDebrid", false, false),
                badge: { label: "Inactive", variant: "secondary" },
                saving: false
            }
        ]
    };
</script>

<Story name="Default" args={{ section }} />
