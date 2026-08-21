<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import RankingTab from "./ranking-tab.svelte";
    import { fn } from "storybook/test";

    const { Story } = defineMeta({
        title: "settings/RankingTab",
        component: RankingTab,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen"
        },
        args: {
            activeProfileName: null,
            newProfileName: "",
            savingProfile: false,
            saveAsProfile: fn(),
            toggleProfileEnabled: fn(),
            applyProfile: fn(),
            deleteCustomProfile: fn(),
            saveActiveProfileSettings: fn()
        }
    });
</script>

<script lang="ts">
    import type { CustomProfile, QualityProfile, SettingFieldDef } from "./types";

    const rankSchema: SettingFieldDef[] = [
        { key: "r1080p", label: "1080p", type: "custom_rank", required: false },
        { key: "r2160p", label: "2160p", type: "custom_rank", required: false }
    ];

    const rank = {
        r1080p: { fetch: true, rank: 100 },
        r2160p: { fetch: false, rank: 50 }
    };

    const qualityProfiles: QualityProfile[] = [
        {
            id: "balanced",
            label: "Balanced",
            description: "A good mix of quality and size.",
            settings: {}
        },
        {
            id: "best",
            label: "Best Quality",
            description: "Highest resolution and bitrate.",
            settings: {}
        }
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
</script>

<Story name="Default" args={{ rank, rankSchema, qualityProfiles, customProfiles }} />
