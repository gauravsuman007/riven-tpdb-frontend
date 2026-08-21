<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import SettingFieldEditor from "./setting-field-editor.svelte";

    const { Story } = defineMeta({
        title: "settings/SettingFieldEditor",
        component: SettingFieldEditor,
        tags: ["autodocs"]
    });
</script>

<Story
    name="Text"
    args={{
        field: { key: "instance_name", label: "Instance Name", type: "string", required: true },
        value: "My Riven Instance"
    }} />

<Story
    name="Password"
    args={{
        field: { key: "api_key", label: "API Key", type: "password", required: true },
        value: "s3cr3t-key-value"
    }} />

<Story
    name="Number"
    args={{
        field: { key: "max_workers", label: "Max Workers", type: "number", required: false },
        value: 4
    }} />

<Story
    name="Boolean"
    args={{
        field: {
            key: "enable_notifications",
            label: "Enable Notifications",
            type: "boolean",
            required: false
        },
        value: true
    }} />

<Story
    name="NullableBoolean"
    args={{
        field: {
            key: "auto_scrape",
            label: "Auto Scrape",
            type: "nullable_boolean",
            required: false,
            true_label: "Always",
            false_label: "Never"
        },
        value: null
    }} />

<Story
    name="SelectOptions"
    args={{
        field: {
            key: "resolution",
            label: "Preferred Resolution",
            type: "string",
            required: false,
            options: ["480p", "720p", "1080p", "2160p"]
        },
        value: "1080p"
    }} />

<Story
    name="StringArray"
    args={{
        field: {
            key: "excluded_words",
            label: "Excluded Words",
            type: "string_array",
            required: false,
            placeholder: "Add a word"
        },
        value: ["CAM", "TS", "WORKPRINT"]
    }} />

<Story
    name="FilterArray"
    args={{
        field: {
            key: "genre_filter",
            label: "Genre Filter",
            type: "filter_array",
            required: false,
            options: ["Action", "Comedy", "Drama", "Horror", "Sci-Fi"]
        },
        value: { include: ["Action", "Sci-Fi"], exclude: ["Horror"] }
    }} />

<Story
    name="CustomRank"
    args={{
        field: { key: "r1080p", label: "1080p", type: "custom_rank", required: false },
        value: { fetch: true, rank: 100 }
    }} />

<Story
    name="ObjectGrid"
    args={{
        field: {
            key: "quality",
            label: "Quality Settings",
            type: "object",
            required: false,
            display: "grid",
            fields: [
                {
                    key: "min_resolution",
                    label: "Min Resolution",
                    type: "string",
                    required: false,
                    options: ["480p", "720p", "1080p"]
                },
                { key: "max_size_gb", label: "Max Size (GB)", type: "number", required: false }
            ]
        },
        value: { min_resolution: "1080p", max_size_gb: 20 }
    }} />

<Story
    name="Dictionary"
    args={{
        field: {
            key: "custom_profiles",
            label: "Custom Profiles",
            type: "dictionary",
            required: false,
            key_placeholder: "profile_key",
            add_label: "Add profile",
            item_fields: [{ key: "enabled", label: "Enabled", type: "boolean", required: false }]
        },
        value: { anime_profile: { enabled: true }, movies_profile: { enabled: false } }
    }} />
