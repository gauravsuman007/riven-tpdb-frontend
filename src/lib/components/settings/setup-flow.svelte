<script lang="ts">
    /* eslint-disable svelte/no-navigation-without-resolve */
    import { deserialize } from "$app/forms";
    import { goto } from "$app/navigation";
    import { resolve } from "$app/paths";
    import { untrack } from "svelte";
    import { SvelteSet } from "svelte/reactivity";
    import { toast } from "svelte-sonner";
    import {
        buildGeneralSections,
        buildPluginSections,
        buildSetupSteps,
        createSetupState,
        stringifyPluginFields
    } from "./helpers";
    import SetupPluginGroupStep from "./setup-plugin-group-step.svelte";
    import SetupQualityStep from "./setup-quality-step.svelte";
    import SetupReviewStep from "./setup-review-step.svelte";
    import SetupShell from "./setup-shell.svelte";
    import SetupWelcomeStep from "./setup-welcome-step.svelte";
    import type { CustomProfile, PluginInfo, SetupData } from "./types";

    type ActionResult<T> = { ok: true; data: T; redirect?: string } | { ok: false; error: string };

    let { data }: { data: SetupData } = $props();
    const initialState = untrack(() =>
        createSetupState(JSON.parse(JSON.stringify(data)) as SetupData)
    );

    let stepIndex = $state(0);
    let general = $state<Record<string, unknown>>(initialState.general);
    let customProfiles = $state<CustomProfile[]>(initialState.customProfiles);
    let pluginStates = $state<Record<string, PluginInfo>>(initialState.pluginStates);
    let pluginFieldMap = $state<Record<string, Record<string, string>>>({});
    let pluginLoadingMap = $state<Record<string, boolean>>({});
    let pluginSavingMap = $state<Record<string, boolean>>({});
    let revealedFields = $state<Record<string, Set<string>>>({});
    let loadedPlugins = new SvelteSet<string>();
    let pendingPluginLoads = new SvelteSet<string>();

    const enabledProfileCount = $derived(
        customProfiles.filter((profile) => profile.enabled).length
    );
    const validPluginCount = $derived(
        Object.values(pluginStates).filter((plugin) => plugin.enabled && plugin.valid).length
    );
    const setupReady = $derived(validPluginCount > 0 && enabledProfileCount > 0);
    const pluginSections = $derived.by(() =>
        buildPluginSections(pluginStates, {
            pluginFieldMap,
            pluginLoadingMap,
            pluginSavingMap,
            revealedFields
        })
    );
    const generalSections = $derived(buildGeneralSections(data.generalSettingsSchema ?? []));
    const steps = $derived(buildSetupSteps(pluginSections));
    const currentStep = $derived(steps[stepIndex] ?? steps[0]);
    const currentPluginSection = $derived.by(
        () => pluginSections.find((section) => section.id === currentStep?.id) ?? null
    );
    const qualityProfiles = $derived.by(() =>
        (data.qualityProfiles ?? []).map((profile) => ({
            ...profile,
            enabled: customProfiles.some((entry) => entry.name === profile.id && entry.enabled)
        }))
    );

    $effect(() => {
        if (steps.length === 0) return;
        if (stepIndex >= steps.length) stepIndex = steps.length - 1;
    });

    $effect(() => {
        const section = currentPluginSection;
        if (!section) return;

        section.plugins.forEach(({ plugin }) => {
            void ensurePluginLoaded(plugin.name);
        });
    });

    function setPluginField(pluginName: string, fieldKey: string, value: string) {
        pluginFieldMap = {
            ...pluginFieldMap,
            [pluginName]: {
                ...(pluginFieldMap[pluginName] ?? {}),
                [fieldKey]: value
            }
        };
    }

    function toggleReveal(pluginName: string, fieldKey: string) {
        const next = new SvelteSet(revealedFields[pluginName] ?? []);
        if (next.has(fieldKey)) next.delete(fieldKey);
        else next.add(fieldKey);

        revealedFields = {
            ...revealedFields,
            [pluginName]: next
        };
    }

    async function postAction<T>(
        action: string,
        values: Record<string, string>,
        fallbackError: string
    ): Promise<ActionResult<T>> {
        try {
            const formData = new FormData();
            Object.entries(values).forEach(([key, value]) => formData.set(key, value));

            const response = await fetch(`?/${action}`, { method: "POST", body: formData });
            const result = deserialize(await response.text());

            if (result.type === "success") {
                return { ok: true, data: (result.data ?? {}) as T };
            }

            if (result.type === "redirect") {
                return { ok: true, data: {} as T, redirect: result.location };
            }

            const error =
                result.type === "failure"
                    ? String(result.data?.error ?? fallbackError)
                    : fallbackError;

            return {
                ok: false,
                error
            };
        } catch {
            return { ok: false, error: fallbackError };
        }
    }

    async function ensurePluginLoaded(pluginName: string) {
        if (loadedPlugins.has(pluginName) || pendingPluginLoads.has(pluginName)) return;

        pendingPluginLoads.add(pluginName);
        pluginLoadingMap = { ...pluginLoadingMap, [pluginName]: true };

        const result = await postAction<{ pluginSettings?: Record<string, unknown> }>(
            "loadPluginSettings",
            { plugin: pluginName },
            `Failed to load ${pluginName} settings`
        );

        if (result.ok && result.data.pluginSettings) {
            pluginFieldMap = {
                ...pluginFieldMap,
                [pluginName]: stringifyPluginFields(result.data.pluginSettings)
            };
            revealedFields = { ...revealedFields, [pluginName]: new SvelteSet<string>() };
            loadedPlugins = new SvelteSet([...loadedPlugins, pluginName]);
        } else if (!result.ok) {
            toast.error(result.error);
        }

        const nextPending = new SvelteSet(pendingPluginLoads);
        nextPending.delete(pluginName);
        pendingPluginLoads = nextPending;
        pluginLoadingMap = { ...pluginLoadingMap, [pluginName]: false };
    }

    async function saveGeneralSettings() {
        const result = await postAction<never>(
            "updateGeneral",
            { settings: JSON.stringify(general) },
            "Failed to save general settings"
        );

        if (result.ok) toast.success("General settings saved");
        else toast.error(result.error);
    }

    async function savePlugin(pluginName: string) {
        pluginSavingMap = { ...pluginSavingMap, [pluginName]: true };

        const result = await postAction<{ enabled?: boolean; valid?: boolean }>(
            "updatePlugin",
            {
                plugin: pluginName,
                settings: JSON.stringify(pluginFieldMap[pluginName] ?? {})
            },
            `Failed to save ${pluginName}`
        );

        if (result.ok) {
            const enabled = result.data.enabled ?? false;
            const valid = result.data.valid ?? false;

            pluginStates = {
                ...pluginStates,
                [pluginName]: { ...pluginStates[pluginName], enabled, valid }
            };
            setPluginField(pluginName, "enabled", String(enabled));
            toast.success(`${pluginName} saved`);
        } else {
            toast.error(result.error);
        }

        pluginSavingMap = { ...pluginSavingMap, [pluginName]: false };
    }

    async function toggleProfileEnabled(name: string, enabled: boolean) {
        const result = await postAction<never>(
            "setProfileEnabled",
            { name, enabled: String(enabled) },
            "Failed to update profile"
        );

        if (result.ok) {
            customProfiles = customProfiles.map((profile) =>
                profile.name === name ? { ...profile, enabled } : profile
            );
            toast.success(`Profile "${name}" ${enabled ? "enabled" : "disabled"}`);
            return;
        }

        toast.error(result.error);
    }

    function nextStep() {
        if (stepIndex < steps.length - 1) stepIndex += 1;
    }

    function previousStep() {
        if (stepIndex > 0) stepIndex -= 1;
    }

    function goToStep(index: number) {
        stepIndex = index;
    }

    async function finishSetup() {
        const result = await postAction<never>("completeSetup", {}, "Failed to complete setup");

        if (!result.ok) {
            toast.error("Failed to complete setup");
            return;
        }

        const redirectTo = result.redirect ?? resolve("/");
        await goto(redirectTo);
    }
</script>

<svelte:head>
    <title>Initial Setup - Riven</title>
</svelte:head>

<SetupShell {steps} {stepIndex} {goToStep} {previousStep} {nextStep}>
    {#if currentStep?.id === "welcome"}
        <SetupWelcomeStep />
    {:else if currentPluginSection}
        <SetupPluginGroupStep
            setField={setPluginField}
            {toggleReveal}
            {savePlugin}
            section={currentPluginSection} />
    {:else if currentStep?.id === "quality"}
        <SetupQualityStep
            profiles={qualityProfiles}
            {generalSections}
            bind:general
            {saveGeneralSettings}
            {toggleProfileEnabled} />
    {:else}
        <SetupReviewStep {validPluginCount} {enabledProfileCount} {setupReady} {finishSetup} />
    {/if}
</SetupShell>
