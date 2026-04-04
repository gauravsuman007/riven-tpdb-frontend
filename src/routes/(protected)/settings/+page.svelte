<script lang="ts">
    import { deserialize } from "$app/forms";
    import { toast } from "svelte-sonner";
    import PageShell from "$lib/components/page-shell.svelte";
    import * as Tabs from "$lib/components/ui/tabs/index.js";
    import GeneralTab from "$lib/components/settings/general-tab.svelte";
    import PluginsTab from "$lib/components/settings/plugins-tab.svelte";
    import RankingTab from "$lib/components/settings/ranking-tab.svelte";
    import { stringifyPluginFields } from "$lib/components/settings/helpers";
    import type { PageData } from "./$types";
    import type { CustomProfile, PluginInfo, QualityProfile } from "$lib/components/settings/types";

    let { data }: { data: PageData } = $props();

    let activeTab = $state("general");
    const builtinProfileIds = new Set((data.qualityProfiles ?? []).map((profile) => profile.id));

    let general = $state<Record<string, unknown>>({
        ...(data.generalSettings as Record<string, unknown>)
    });
    let plugins = $state<PluginInfo[]>(data.plugins.map((p) => ({ ...p })));
    let selectedPlugin = $state<PluginInfo | null>(plugins.length > 0 ? plugins[0] : null);
    let pluginFields = $state<Record<string, string>>({});
    let pluginLoading = $state(false);
    let pluginSaving = $state(false);
    let loadedPluginName: string | null = null;
    let revealedFields = $state(new Set<string>());

    let rank = $state<Record<string, unknown>>(JSON.parse(JSON.stringify(data.rankSettings ?? {})));
    const qualityProfiles: QualityProfile[] = data.qualityProfiles ?? [];
    let customProfiles = $state<CustomProfile[]>(data.customProfiles ?? []);
    let activeProfileName = $state<string | null>(null);
    let newProfileName = $state("");
    let savingProfile = $state(false);

    function selectPlugin(plugin: PluginInfo) {
        selectedPlugin = plugin;
    }

    function updatePluginState(name: string, enabled: boolean, valid: boolean) {
        const entry = plugins.find((p) => p.name === name);
        if (entry) {
            entry.enabled = enabled;
            entry.valid = valid;
        }
        if (selectedPlugin?.name === name) {
            selectedPlugin.enabled = enabled;
            selectedPlugin.valid = valid;
        }
    }

    async function loadPluginSettings(plugin: PluginInfo) {
        if (loadedPluginName === plugin.name) return;
        pluginFields = {};
        loadedPluginName = null;
        pluginLoading = true;
        try {
            const fd = new FormData();
            fd.set("plugin", plugin.name);
            const res = await fetch("?/loadPluginSettings", { method: "POST", body: fd });
            const result = deserialize(await res.text());
            if (result.type === "success" && result.data?.pluginSettings) {
                pluginFields = stringifyPluginFields(
                    result.data.pluginSettings as Record<string, unknown>
                );
                loadedPluginName = plugin.name;
                revealedFields = new Set();
            }
        } catch {
            toast.error("Failed to load plugin settings");
        } finally {
            pluginLoading = false;
        }
    }

    $effect(() => {
        if (selectedPlugin) loadPluginSettings(selectedPlugin);
    });

    function applyProfile(settings: Record<string, unknown>, profileName?: string) {
        activeProfileName = profileName ?? null;
        const base = JSON.parse(JSON.stringify(settings)) as Record<string, unknown>;
        rank = {
            ...base,
            require: rank.require ?? [],
            exclude: rank.exclude ?? [],
            preferred: rank.preferred ?? [],
            languages: rank.languages ?? {}
        };
    }

    async function saveActiveProfileSettings() {
        if (!activeProfileName) return;
        try {
            const fd = new FormData();
            fd.set("name", activeProfileName);
            fd.set("settings", JSON.stringify(rank));
            const res = await fetch("?/updateProfileSettings", { method: "POST", body: fd });
            const result = deserialize(await res.text());
            if (result.type !== "success")
                toast.error(`Failed to update profile "${activeProfileName}"`);
        } catch {
            toast.error(`Failed to update profile "${activeProfileName}"`);
        }
    }

    async function saveAsProfile() {
        const name = newProfileName.trim();
        if (!name) return;
        savingProfile = true;
        try {
            const fd = new FormData();
            fd.set("name", name);
            fd.set("settings", JSON.stringify(rank));
            const res = await fetch("?/saveCustomProfile", { method: "POST", body: fd });
            const result = deserialize(await res.text());
            if (result.type === "success" && result.data?.profile) {
                const profile = result.data.profile as CustomProfile;
                const idx = customProfiles.findIndex((p) => p.id === profile.id);
                if (idx >= 0) customProfiles[idx] = profile;
                else customProfiles.push(profile);
                newProfileName = "";
                toast.success(`Profile "${profile.name}" saved`);
            } else {
                toast.error("Failed to save profile");
            }
        } catch {
            toast.error("Failed to save profile");
        } finally {
            savingProfile = false;
        }
    }

    async function toggleProfileEnabled(name: string, enabled: boolean) {
        const fd = new FormData();
        fd.set("name", name);
        fd.set("enabled", String(enabled));
        const res = await fetch("?/setProfileEnabled", { method: "POST", body: fd });
        const result = deserialize(await res.text());
        if (result.type === "success") {
            const cp = customProfiles.find((p) => p.name === name);
            if (cp) cp.enabled = enabled;
            toast.success(`Profile "${name}" ${enabled ? "enabled" : "disabled"}`);
        } else {
            toast.error("Failed to update profile");
        }
    }

    async function deleteCustomProfile(id: number, name: string) {
        const fd = new FormData();
        fd.set("id", String(id));
        const res = await fetch("?/deleteCustomProfile", { method: "POST", body: fd });
        const result = deserialize(await res.text());
        if (result.type === "success") {
            customProfiles = customProfiles.filter((p) => p.id !== id);
            toast.success(`Profile "${name}" deleted`);
        } else {
            toast.error("Failed to delete profile");
        }
    }

    function removeTag(arr: string[], i: number) {
        arr.splice(i, 1);
    }

    function addTagOnEnter(arr: string[], e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            const val = e.currentTarget.value.trim();
            if (val && !arr.includes(val)) arr.push(val);
            e.currentTarget.value = "";
        }
    }
</script>

<svelte:head>
    <title>Settings - Riven</title>
</svelte:head>

<PageShell>
    <div class="mx-auto w-full max-w-5xl">
        <div class="mb-8">
            <h1 class="text-3xl font-semibold tracking-tight">Settings</h1>
            <p class="text-muted-foreground mt-1 text-sm">
                Configure Riven, plugins, and ranking preferences.
            </p>
        </div>

        <Tabs.Root bind:value={activeTab}>
            <Tabs.List class="mb-6 w-full justify-start">
                <Tabs.Trigger value="general">General</Tabs.Trigger>
                <Tabs.Trigger value="plugins">Plugins</Tabs.Trigger>
                <Tabs.Trigger value="ranking">Ranking</Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="general">
                <GeneralTab {general} schema={data.generalSettingsSchema} />
            </Tabs.Content>

            <Tabs.Content value="plugins">
                <PluginsTab
                    {plugins}
                    bind:selectedPlugin
                    bind:pluginFields
                    {pluginLoading}
                    bind:pluginSaving
                    bind:revealedFields
                    {selectPlugin}
                    onPluginSaved={updatePluginState} />
            </Tabs.Content>

            <Tabs.Content value="ranking">
                <RankingTab
                    bind:rank
                    {qualityProfiles}
                    bind:customProfiles
                    bind:newProfileName
                    bind:savingProfile
                    {saveAsProfile}
                    {toggleProfileEnabled}
                    {applyProfile}
                    {deleteCustomProfile}
                    {saveActiveProfileSettings}
                    {removeTag}
                    {addTagOnEnter} />
            </Tabs.Content>
        </Tabs.Root>
    </div>
</PageShell>
