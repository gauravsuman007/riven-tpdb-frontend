<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import GeneralTab from "./general-tab.svelte";
    import { fn } from "storybook/test";

    const { Story } = defineMeta({
        title: "settings/GeneralTab",
        component: GeneralTab,
        tags: ["autodocs"],
        args: {
            save: fn()
        }
    });
</script>

<script lang="ts">
    import type { SettingsSection } from "./types";

    const section: SettingsSection = {
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
            },
            {
                key: "enable_notifications",
                label: "Enable Notifications",
                type: "boolean",
                required: false,
                section: "Notifications"
            }
        ],
        values: {
            instance_name: "My Riven Instance",
            log_level: "info",
            enable_notifications: true
        }
    };
</script>

<Story name="Default" args={{ section }} />
