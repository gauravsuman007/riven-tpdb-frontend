<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import SetupWelcomeStep from "./setup-welcome-step.svelte";

    const { Story } = defineMeta({
        title: "settings/SetupWelcomeStep",
        component: SetupWelcomeStep,
        tags: ["autodocs"]
    });
</script>

<Story name="Default" />
