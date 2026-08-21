<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import SetupReviewStep from "./setup-review-step.svelte";
    import { fn } from "storybook/test";

    const { Story } = defineMeta({
        title: "settings/SetupReviewStep",
        component: SetupReviewStep,
        tags: ["autodocs"],
        args: {
            finishSetup: fn()
        }
    });
</script>

<Story
    name="Ready"
    args={{
        validPluginCount: 3,
        enabledProfileCount: 2,
        readyToComplete: true,
        blockers: []
    }} />

<Story
    name="Blocked"
    args={{
        validPluginCount: 1,
        enabledProfileCount: 0,
        readyToComplete: false,
        blockers: ["No quality profile enabled", "No downloader configured"]
    }} />
