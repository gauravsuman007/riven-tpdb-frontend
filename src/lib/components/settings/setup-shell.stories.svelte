<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import SetupShell from "./setup-shell.svelte";
    import { fn } from "storybook/test";

    const { Story } = defineMeta({
        title: "settings/SetupShell",
        component: SetupShell,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen"
        }
    });

    const steps = [
        {
            id: "welcome",
            label: "Welcome",
            description: "Quick overview before you connect providers."
        },
        {
            id: "downloaders",
            label: "Downloaders",
            description: "Configure your downloader plugins."
        },
        { id: "quality", label: "Quality", description: "Choose profiles and instance defaults." },
        { id: "finish", label: "Review", description: "Check readiness and finish setup." }
    ];
</script>

<Story name="Default" asChild>
    <SetupShell {steps} stepIndex={1} goToStep={fn()} previousStep={fn()} nextStep={fn()}>
        <div class="rounded-lg border p-8 text-center">Step content goes here.</div>
    </SetupShell>
</Story>
