<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import SetupQualityStep from "./setup-quality-step.svelte";
    import { fn } from "storybook/test";

    const { Story } = defineMeta({
        title: "settings/SetupQualityStep",
        component: SetupQualityStep,
        tags: ["autodocs"],
        args: {
            toggleProfileEnabled: fn(),
            saveGeneralSettings: fn()
        }
    });
</script>

<script lang="ts">
    import type { SetupProfileView, SetupGeneralSection } from "./types";

    const profiles: SetupProfileView[] = [
        {
            id: "balanced",
            label: "Balanced",
            description: "A good mix of quality and file size.",
            settings: {},
            enabled: true
        },
        {
            id: "best",
            label: "Best Quality",
            description: "Prioritizes the highest resolution and bitrate.",
            settings: {},
            enabled: false
        }
    ];

    const generalSections: SetupGeneralSection[] = [
        {
            title: "General",
            description: "",
            fields: [
                { key: "instance_name", label: "Instance Name", type: "string", required: true }
            ]
        }
    ];

    const general = { instance_name: "My Riven Instance" };
</script>

<Story name="Default" args={{ profiles, generalSections, general }} />
