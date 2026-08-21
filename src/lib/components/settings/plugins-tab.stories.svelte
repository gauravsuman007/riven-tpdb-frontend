<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import PluginsTab from "./plugins-tab.svelte";
    import { fn } from "storybook/test";

    const { Story } = defineMeta({
        title: "settings/PluginsTab",
        component: PluginsTab,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen"
        },
        args: {
            save: fn()
        }
    });
</script>

<script lang="ts">
    import type { SettingsSection, SetupGroup } from "./types";

    const groups: SetupGroup[] = [
        {
            id: "downloaders",
            title: "Downloaders",
            description: "Fetch media from your debrid service."
        },
        { id: "indexers", title: "Indexers", description: "Search for releases." }
    ];

    const sections: SettingsSection[] = [
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
        },
        {
            id: "prowlarr",
            title: "Prowlarr",
            kind: "plugin",
            category: "indexers",
            enabled: false,
            valid: false,
            configured: false,
            missingRequiredFields: ["api_key"],
            schema: [{ key: "api_key", label: "API Key", type: "password", required: true }],
            values: {}
        }
    ];
</script>

<Story name="Default" args={{ sections, groups }} />
