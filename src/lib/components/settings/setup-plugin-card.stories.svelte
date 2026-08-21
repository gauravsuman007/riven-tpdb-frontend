<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import SetupPluginCard from "./setup-plugin-card.svelte";
    import { fn } from "storybook/test";

    const { Story } = defineMeta({
        title: "settings/SetupPluginCard",
        component: SetupPluginCard,
        tags: ["autodocs"],
        args: {
            saving: false,
            savePlugin: fn()
        }
    });
</script>

<script lang="ts">
    import type { SettingsSection } from "./types";

    const section: SettingsSection = {
        id: "real_debrid",
        title: "Real-Debrid",
        kind: "plugin",
        version: "1.2.0",
        enabled: true,
        valid: true,
        configured: true,
        missingRequiredFields: [],
        schema: [
            { key: "api_key", label: "API Key", type: "password", required: true },
            { key: "enabled", label: "Enabled", type: "boolean", required: false }
        ],
        values: { api_key: "s3cr3t", enabled: true }
    };

    const emptySection: SettingsSection = {
        ...section,
        id: "no_fields_plugin",
        title: "Simple Plugin",
        schema: [],
        values: {}
    };
</script>

<Story name="Default" args={{ section }} />

<Story name="Saving" args={{ section, saving: true }} />

<Story name="NoFields" args={{ section: emptySection }} />
