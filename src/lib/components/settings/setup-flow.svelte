<script lang="ts">
    import { deserialize } from "$app/forms";
    import { resolve } from "$app/paths";
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import SetupPluginGroupStep from "./setup-plugin-group-step.svelte";
    import SetupQualityStep from "./setup-quality-step.svelte";
    import SetupReviewStep from "./setup-review-step.svelte";
    import SetupWelcomeStep from "./setup-welcome-step.svelte";
    import type {
        CustomProfile,
        PluginInfo,
        QualityProfile,
        SettingFieldDef,
        SetupSummary
    } from "./types";

    type SetupData = {
        generalSettings: Record<string, unknown>;
        generalSettingsSchema: SettingFieldDef[];
        plugins: PluginInfo[];
        rankSettings: Record<string, unknown>;
        qualityProfiles: QualityProfile[];
        customProfiles: CustomProfile[];
        setupSummary: SetupSummary;
    };

    type Step = {
        id: "welcome" | "media" | "sources" | "services" | "quality" | "finish";
        label: string;
        description: string;
    };

    type PluginGroup = {
        title: string;
        description: string;
        names: string[];
        emptyMessage: string;
    };

    let { data }: { data: SetupData } = $props();

    const steps: Step[] = [
        {
            id: "welcome",
            label: "Welcome",
            description: "Confirm what setup covers before you start wiring providers."
        },
        {
            id: "media",
            label: "Media Servers",
            description:
                "Connect Plex, Emby, or Jellyfin first so Riven knows your library targets."
        },
        {
            id: "sources",
            label: "Content Sources",
            description: "Enable the stream providers you actually plan to scrape from."
        },
        {
            id: "services",
            label: "Metadata & Requests",
            description:
                "Connect the discovery, metadata, and request services that round out the stack."
        },
        {
            id: "quality",
            label: "Quality",
            description:
                "Choose the playback profiles and default runtime preferences for this instance."
        },
        {
            id: "finish",
            label: "Review",
            description: "Check readiness, then finish onboarding and enter the app."
        }
    ];

    const mediaPluginGroup: PluginGroup = {
        title: "Media Servers",
        description:
            "These plugins connect Riven to the servers you already use to watch and organise media.",
        names: ["plex", "emby-jellyfin", "emby", "jellyfin"],
        emptyMessage: "No media-server plugins are registered in this instance."
    };
    const sourcePluginGroup: PluginGroup = {
        title: "Content Sources",
        description: "These providers supply the candidate streams that Riven indexes and ranks.",
        names: ["torrentio", "comet", "stremthru"],
        emptyMessage: "No source plugins are registered in this instance."
    };
    const servicePluginGroup: PluginGroup = {
        title: "Metadata, Discovery, and Requests",
        description:
            "These services enrich metadata, watchlists, discovery, and request workflows.",
        names: ["tmdb", "tvdb", "trakt", "seerr", "mdblist", "listrr", "calendar"],
        emptyMessage: "No metadata/request plugins are registered in this instance."
    };
    const generalSections = [
        {
            title: "Language",
            description: "Language preferences that affect what Riven will fetch by default.",
            keys: ["dubbed_anime_only"]
        },
        {
            title: "Scheduling",
            description: "How often Riven retries and when unreleased content gets re-indexed.",
            keys: ["retry_interval_secs", "schedule_offset_minutes", "unknown_air_date_offset_days"]
        },
        {
            title: "Bitrate Limits",
            description: "Optional bitrate guards to stop very small encodes or oversized files.",
            keys: [
                "minimum_average_bitrate_movies",
                "minimum_average_bitrate_episodes",
                "maximum_average_bitrate_movies",
                "maximum_average_bitrate_episodes"
            ]
        }
    ];

    let stepIndex = $state(0);
    const qualityProfiles: QualityProfile[] = data.qualityProfiles ?? [];
    let customProfiles = $state<CustomProfile[]>(data.customProfiles ?? []);
    let general = $state<Record<string, unknown>>({
        ...(data.generalSettings as Record<string, unknown>)
    });
    let pluginStates = $state<Record<string, PluginInfo>>(
        Object.fromEntries(data.plugins.map((plugin) => [plugin.name, { ...plugin }]))
    );
    let pluginFieldMap = $state<Record<string, Record<string, string>>>({});
    let pluginLoadingMap = $state<Record<string, boolean>>({});
    let pluginSavingMap = $state<Record<string, boolean>>({});
    let loadedPlugins = $state(new Set<string>());
    let revealedFields = $state<Record<string, Set<string>>>({});

    const enabledProfileCount = $derived(
        customProfiles.filter((profile) => profile.enabled).length
    );
    const setupReady = $derived(
        Object.values(pluginStates).some((plugin) => plugin.enabled && plugin.valid) &&
            enabledProfileCount > 0
    );

    function normalizePluginName(name: string) {
        return name.trim().toLowerCase();
    }

    function getGroupedPlugins(group: PluginGroup) {
        const wanted = new Set(group.names.map(normalizePluginName));
        return Object.values(pluginStates).filter((plugin) =>
            wanted.has(normalizePluginName(plugin.name))
        );
    }

    function getOtherPlugins() {
        const claimed = new Set(
            [
                ...mediaPluginGroup.names,
                ...sourcePluginGroup.names,
                ...servicePluginGroup.names
            ].map(normalizePluginName)
        );
        return Object.values(pluginStates).filter(
            (plugin) => !claimed.has(normalizePluginName(plugin.name))
        );
    }

    function pluginBadge(plugin: PluginInfo): { label: string; variant: "default" | "secondary" } {
        if (!plugin.enabled) return { label: "Disabled", variant: "secondary" };
        if (plugin.valid) return { label: "Ready", variant: "default" };
        return { label: "Needs input", variant: "secondary" };
    }

    function pluginFieldKey(pluginName: string, fieldKey: string) {
        return `${pluginName}:${fieldKey}`;
    }

    function pluginFields(pluginName: string) {
        return pluginFieldMap[pluginName] ?? {};
    }

    function pluginReveals(pluginName: string) {
        return revealedFields[pluginName] ?? new Set<string>();
    }

    function setPluginField(pluginName: string, fieldKey: string, value: string) {
        if (!pluginFieldMap[pluginName]) pluginFieldMap[pluginName] = {};
        pluginFieldMap[pluginName][fieldKey] = value;
    }

    function toggleReveal(pluginName: string, fieldKey: string) {
        const next = new Set(pluginReveals(pluginName));
        if (next.has(fieldKey)) next.delete(fieldKey);
        else next.add(fieldKey);
        revealedFields[pluginName] = next;
    }

    async function ensurePluginLoaded(pluginName: string) {
        if (loadedPlugins.has(pluginName)) return;
        pluginLoadingMap[pluginName] = true;
        try {
            const fd = new FormData();
            fd.set("plugin", pluginName);
            const res = await fetch("?/loadPluginSettings", { method: "POST", body: fd });
            const result = deserialize(await res.text());
            if (result.type === "success" && result.data?.pluginSettings) {
                pluginFieldMap[pluginName] = Object.fromEntries(
                    Object.entries(result.data.pluginSettings as Record<string, unknown>).map(
                        ([key, value]) => [key, value == null ? "" : String(value)]
                    )
                );
                revealedFields[pluginName] = new Set<string>();
                loadedPlugins = new Set([...loadedPlugins, pluginName]);
            } else {
                toast.error(`Failed to load ${pluginName} settings`);
            }
        } catch {
            toast.error(`Failed to load ${pluginName} settings`);
        } finally {
            pluginLoadingMap[pluginName] = false;
        }
    }

    $effect(() => {
        const currentStep = steps[stepIndex].id;
        if (currentStep === "media")
            getGroupedPlugins(mediaPluginGroup).forEach((plugin) =>
                ensurePluginLoaded(plugin.name)
            );
        if (currentStep === "sources")
            getGroupedPlugins(sourcePluginGroup).forEach((plugin) =>
                ensurePluginLoaded(plugin.name)
            );
        if (currentStep === "services")
            [...getGroupedPlugins(servicePluginGroup), ...getOtherPlugins()].forEach((plugin) =>
                ensurePluginLoaded(plugin.name)
            );
    });

    async function saveGeneralSettings() {
        try {
            const fd = new FormData();
            fd.set("settings", JSON.stringify(general));
            const res = await fetch("?/updateGeneral", { method: "POST", body: fd });
            const result = deserialize(await res.text());
            if (result.type === "success") toast.success("General settings saved");
            else toast.error("Failed to save general settings");
        } catch {
            toast.error("Failed to save general settings");
        }
    }

    async function savePlugin(pluginName: string) {
        pluginSavingMap[pluginName] = true;
        try {
            const fd = new FormData();
            fd.set("plugin", pluginName);
            fd.set("settings", JSON.stringify(pluginFields(pluginName)));
            const res = await fetch("?/updatePlugin", { method: "POST", body: fd });
            const result = deserialize(await res.text());
            if (result.type === "success") {
                const enabled = (result.data as { enabled?: boolean })?.enabled ?? false;
                const valid = (result.data as { valid?: boolean })?.valid ?? false;
                pluginStates[pluginName] = { ...pluginStates[pluginName], enabled, valid };
                setPluginField(pluginName, "enabled", String(enabled));
                toast.success(`${pluginName} saved`);
            } else {
                toast.error(`Failed to save ${pluginName}`);
            }
        } catch {
            toast.error(`Failed to save ${pluginName}`);
        } finally {
            pluginSavingMap[pluginName] = false;
        }
    }

    async function toggleProfileEnabled(name: string, enabled: boolean) {
        try {
            const fd = new FormData();
            fd.set("name", name);
            fd.set("enabled", String(enabled));
            const res = await fetch("?/setProfileEnabled", { method: "POST", body: fd });
            const result = deserialize(await res.text());
            if (result.type === "success") {
                const target = customProfiles.find((profile) => profile.name === name);
                if (target) target.enabled = enabled;
                toast.success(`Profile "${name}" ${enabled ? "enabled" : "disabled"}`);
            } else {
                toast.error("Failed to update profile");
            }
        } catch {
            toast.error("Failed to update profile");
        }
    }

    function generalFieldsFor(sectionKeys: string[]) {
        return data.generalSettingsSchema.filter((field) => sectionKeys.includes(field.key));
    }

    function isProfileEnabled(profileId: string) {
        return !!customProfiles.find((entry) => entry.name === profileId)?.enabled;
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
        const res = await fetch("?/completeSetup", { method: "POST" });
        if (!res.ok) {
            toast.error("Failed to complete setup");
            return;
        }
        await goto(resolve("/"));
    }
</script>

<svelte:head>
    <title>Initial Setup - Riven</title>
</svelte:head>

<div class="bg-background flex min-h-[calc(100vh-5rem)] flex-col">
    <div class="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-6 py-8 md:px-10">
        <aside class="hidden w-72 shrink-0 lg:block">
            <div class="bg-card sticky top-8 rounded-3xl border p-5">
                <p class="text-muted-foreground text-xs font-medium tracking-[0.24em] uppercase">
                    Initial Setup
                </p>
                <h1 class="mt-3 text-3xl font-semibold tracking-tight">Walkthrough</h1>
                <p class="text-muted-foreground mt-3 text-sm">
                    This is a separate first-run flow. Configure the instance once, then use normal
                    settings later for maintenance.
                </p>
                <div class="mt-6 space-y-2">
                    {#each steps as step, index}
                        <button
                            type="button"
                            onclick={() => goToStep(index)}
                            class="w-full rounded-2xl border px-4 py-3 text-left transition-colors {index ===
                            stepIndex
                                ? 'border-primary bg-primary/5'
                                : 'hover:bg-muted/40'}">
                            <p class="text-muted-foreground text-xs tracking-wide uppercase">
                                Step {index + 1}
                            </p>
                            <p class="mt-1 font-medium">{step.label}</p>
                            <p class="text-muted-foreground mt-1 text-xs">{step.description}</p>
                        </button>
                    {/each}
                </div>
            </div>
        </aside>

        <main class="min-w-0 flex-1">
            <div class="mb-6 flex flex-wrap items-start justify-between gap-4 lg:hidden">
                <div>
                    <p
                        class="text-muted-foreground text-xs font-medium tracking-[0.24em] uppercase">
                        Initial Setup
                    </p>
                    <h1 class="mt-2 text-3xl font-semibold tracking-tight">
                        {steps[stepIndex].label}
                    </h1>
                </div>
                <Badge variant={setupReady ? "default" : "secondary"}
                    >{setupReady ? "Ready" : "Needs attention"}</Badge>
            </div>

            <section class="bg-card rounded-3xl border p-6 md:p-8">
                {#if steps[stepIndex].id === "welcome"}
                    <SetupWelcomeStep
                        validPlugins={data.setupSummary.validPlugins}
                        totalPlugins={data.setupSummary.totalPlugins}
                        {enabledProfileCount}
                        missingRequiredConfig={data.setupSummary.pluginsMissingRequiredConfig} />
                {:else if steps[stepIndex].id === "media"}
                    <SetupPluginGroupStep
                        title={mediaPluginGroup.title}
                        description={mediaPluginGroup.description}
                        plugins={getGroupedPlugins(mediaPluginGroup)}
                        emptyMessage={mediaPluginGroup.emptyMessage}
                        getFields={pluginFields}
                        getLoading={(name) => pluginLoadingMap[name] ?? false}
                        getSaving={(name) => pluginSavingMap[name] ?? false}
                        getReveals={pluginReveals}
                        getBadge={pluginBadge}
                        fieldKey={pluginFieldKey}
                        setField={setPluginField}
                        {toggleReveal}
                        {savePlugin} />
                {:else if steps[stepIndex].id === "sources"}
                    <SetupPluginGroupStep
                        title={sourcePluginGroup.title}
                        description={sourcePluginGroup.description}
                        plugins={getGroupedPlugins(sourcePluginGroup)}
                        emptyMessage={sourcePluginGroup.emptyMessage}
                        getFields={pluginFields}
                        getLoading={(name) => pluginLoadingMap[name] ?? false}
                        getSaving={(name) => pluginSavingMap[name] ?? false}
                        getReveals={pluginReveals}
                        getBadge={pluginBadge}
                        fieldKey={pluginFieldKey}
                        setField={setPluginField}
                        {toggleReveal}
                        {savePlugin} />
                {:else if steps[stepIndex].id === "services"}
                    <div class="space-y-8">
                        <SetupPluginGroupStep
                            title={servicePluginGroup.title}
                            description={servicePluginGroup.description}
                            plugins={getGroupedPlugins(servicePluginGroup)}
                            emptyMessage={servicePluginGroup.emptyMessage}
                            getFields={pluginFields}
                            getLoading={(name) => pluginLoadingMap[name] ?? false}
                            getSaving={(name) => pluginSavingMap[name] ?? false}
                            getReveals={pluginReveals}
                            getBadge={pluginBadge}
                            fieldKey={pluginFieldKey}
                            setField={setPluginField}
                            {toggleReveal}
                            {savePlugin} />

                        {#if getOtherPlugins().length > 0}
                            <SetupPluginGroupStep
                                title="Other Plugins"
                                description="Additional plugins that do not fit the main onboarding buckets still appear here so first-run setup can cover the whole instance."
                                plugins={getOtherPlugins()}
                                emptyMessage=""
                                getFields={pluginFields}
                                getLoading={(name) => pluginLoadingMap[name] ?? false}
                                getSaving={(name) => pluginSavingMap[name] ?? false}
                                getReveals={pluginReveals}
                                getBadge={pluginBadge}
                                fieldKey={pluginFieldKey}
                                setField={setPluginField}
                                {toggleReveal}
                                {savePlugin} />
                        {/if}
                    </div>
                {:else if steps[stepIndex].id === "quality"}
                    <SetupQualityStep
                        {qualityProfiles}
                        {generalSections}
                        {generalFieldsFor}
                        bind:general
                        {saveGeneralSettings}
                        {toggleProfileEnabled}
                        {isProfileEnabled} />
                {:else}
                    <SetupReviewStep
                        validPluginCount={Object.values(pluginStates).filter(
                            (plugin) => plugin.enabled && plugin.valid
                        ).length}
                        {enabledProfileCount}
                        {setupReady}
                        {finishSetup} />
                {/if}
            </section>

            <div class="mt-6 flex items-center justify-between">
                <Button
                    type="button"
                    variant="outline"
                    disabled={stepIndex === 0}
                    onclick={previousStep}>Previous</Button>
                <div class="text-muted-foreground text-sm">
                    Step {stepIndex + 1} of {steps.length}
                </div>
                <Button type="button" disabled={stepIndex === steps.length - 1} onclick={nextStep}
                    >Next</Button>
            </div>
        </main>
    </div>
</div>
