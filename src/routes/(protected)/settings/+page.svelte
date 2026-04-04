<script lang="ts">
    import { enhance, deserialize } from "$app/forms";
    import { toast } from "svelte-sonner";
    import PageShell from "$lib/components/page-shell.svelte";
    import * as Tabs from "$lib/components/ui/tabs/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Separator } from "$lib/components/ui/separator/index.js";
    import type { PageData } from "./$types";
    import type { CustomProfile, PluginInfo, QualityProfile, SettingFieldDef } from "./+page.server";

    let { data }: { data: PageData } = $props();

    // ── General ───────────────────────────────────────────────────────────────
    // Keyed by field name; values are whatever the backend returned (bool/number/null/string)
    let general = $state<Record<string, unknown>>({ ...(data.generalSettings as Record<string, unknown>) });

    // ── Plugins ───────────────────────────────────────────────────────────────
    // Mutable copy so we can update valid status after saving without a page reload.
    let plugins = $state<PluginInfo[]>(data.plugins.map((p) => ({ ...p })));
    let selectedPlugin = $state<PluginInfo | null>(plugins.length > 0 ? plugins[0] : null);
    let pluginFields = $state<Record<string, string>>({});
    let pluginLoading = $state(false);
    let pluginSaving = $state(false);
    // Plain (non-reactive) variable so we can guard re-fetches without
    // being tracked by the $effect below.
    let loadedPluginName: string | null = null;
    // Tracks which password fields are currently revealed (type=text).
    let revealedFields = $state(new Set<string>());

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

    function stringifyPluginFields(settings: Record<string, unknown>): Record<string, string> {
        return Object.fromEntries(
            Object.entries(settings).map(([key, value]) => [key, value == null ? "" : String(value)])
        );
    }

    function pluginStatus(plugin: PluginInfo): { label: string; variant: "default" | "secondary" } {
        if (!plugin.enabled) return { label: "Disabled", variant: "secondary" };
        if (plugin.valid) return { label: "Active", variant: "default" };
        return { label: "Invalid", variant: "secondary" };
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
                pluginFields = stringifyPluginFields(result.data.pluginSettings as Record<string, unknown>);
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
        // Only reads selectedPlugin — does not write it, preventing a reactive loop.
        if (selectedPlugin) loadPluginSettings(selectedPlugin);
    });

    // ── Ranking ───────────────────────────────────────────────────────────────
    // The full rank settings object — we keep it as-is from the server and mutate it.
    let rank = $state<Record<string, unknown>>(
        JSON.parse(JSON.stringify(data.rankSettings ?? {}))
    );

    // Built-in profile presets from the backend.
    const qualityProfiles: QualityProfile[] = data.qualityProfiles ?? [];

    // User-created custom profiles (mutable so we can add/remove without reload).
    let customProfiles = $state<CustomProfile[]>(data.customProfiles ?? []);

    // Track the profile currently loaded in the editor (so save persists to it).
    let activeProfileName = $state<string | null>(null);

    // "Save as profile" UI state.
    let newProfileName = $state("");
    let savingProfile = $state(false);

    function applyProfile(settings: Record<string, unknown>, profileName?: string) {
        activeProfileName = profileName ?? null;
        const base = JSON.parse(JSON.stringify(settings)) as Record<string, unknown>;
        rank = {
            ...base,
            require:   rank.require   ?? [],
            exclude:   rank.exclude   ?? [],
            preferred: rank.preferred ?? [],
            languages: rank.languages ?? {},
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
            if (result.type !== "success") {
                toast.error(`Failed to update profile "${activeProfileName}"`);
            }
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
            // Update local state for the matching custom profile
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

    // Tag helpers
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

    // Detect the "shape" of a value for dynamic rendering
    type Shape =
        | "boolean"
        | "number"
        | "string"
        | "string_array"          // string[]
        | "bool_object"           // Record<string, boolean>
        | "number_object"         // Record<string, number>
        | "custom_rank_object"    // Record<string, {fetch, rank?: number|null}>
        | "settings_section"      // Record<string, unknown> — generic nested section
        | "unknown";

    function detectShape(v: unknown): Shape {
        if (typeof v === "boolean") return "boolean";
        if (typeof v === "number") return "number";
        if (typeof v === "string") return "string";
        if (Array.isArray(v)) {
            if (v.every((x) => typeof x === "string")) return "string_array";
            return "unknown";
        }
        if (v !== null && typeof v === "object") {
            const entries = Object.entries(v as object);
            if (entries.every(([, val]) => typeof val === "boolean")) return "bool_object";
            if (entries.every(([, val]) => typeof val === "number")) return "number_object";
            if (
                entries.length > 0 &&
                entries.every(
                    ([, val]) =>
                        val !== null &&
                        typeof val === "object" &&
                        "fetch" in (val as object)
                )
            )
                return "custom_rank_object";
            return "settings_section";
        }
        return "unknown";
    }

    function toLabel(key: string): string {
        return key
            .replace(/^r(\d+p)$/, "$1")           // r1080p → 1080p
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
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

        <Tabs.Root value="general">
            <Tabs.List class="mb-6 w-full justify-start">
                <Tabs.Trigger value="general">General</Tabs.Trigger>
                <Tabs.Trigger value="plugins">Plugins</Tabs.Trigger>
                <Tabs.Trigger value="ranking">Ranking</Tabs.Trigger>
            </Tabs.List>

            <!-- ── General ─────────────────────────────────────────────────── -->
            <Tabs.Content value="general">
                <form
                    method="POST"
                    action="?/updateGeneral"
                    use:enhance={() =>
                        async ({ result }) => {
                            if (result.type === "success") toast.success("General settings saved");
                            else toast.error("Failed to save general settings");
                        }}>
                    <input type="hidden" name="settings" value={JSON.stringify(general)} />

                    <div class="space-y-4">
                        {#each data.generalSettingsSchema as field (field.key)}
                            {@const val = general[field.key]}
                            <div class="rounded-lg border p-4">
                                {#if field.type === "boolean"}
                                    <div class="flex items-center justify-between">
                                        <div class="space-y-0.5">
                                            <Label class="text-base">{field.label}</Label>
                                            {#if field.description}
                                                <p class="text-muted-foreground text-sm">{field.description}</p>
                                            {/if}
                                        </div>
                                        <Switch
                                            checked={!!val}
                                            onCheckedChange={(v) => (general[field.key] = v)} />
                                    </div>
                                {:else}
                                    <div class="space-y-2">
                                        <Label for="gen-{field.key}">{field.label}</Label>
                                        {#if field.description}
                                            <p class="text-muted-foreground text-sm">{field.description}</p>
                                        {/if}
                                        <Input
                                            id="gen-{field.key}"
                                            type={field.type === "number" ? "number" : "text"}
                                            min={field.type === "number" ? "0" : undefined}
                                            placeholder={field.placeholder ?? field.default_value ?? ""}
                                            value={val != null ? String(val) : ""}
                                            oninput={(e) => {
                                                const raw = (e.currentTarget as HTMLInputElement).value;
                                                general[field.key] = field.type === "number"
                                                    ? (raw === "" ? null : Number(raw))
                                                    : raw;
                                            }}
                                            class="max-w-xs" />
                                    </div>
                                {/if}
                            </div>
                        {/each}

                        <Button type="submit">Save general settings</Button>
                    </div>
                </form>
            </Tabs.Content>

            <!-- ── Plugins ────────────────────────────────────────────────── -->
            <Tabs.Content value="plugins">
                {#if plugins.length === 0}
                    <p class="text-muted-foreground text-sm">No plugins registered.</p>
                {:else}
                    <div class="flex gap-6">
                        <aside class="w-48 shrink-0 space-y-1">
                            {#each plugins as plugin}
                                <button
                                    type="button"
                                    onclick={() => { selectedPlugin = plugin; }}
                                    class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors {selectedPlugin?.name === plugin.name ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}">
                                    <span
                                        class="h-2 w-2 shrink-0 rounded-full {plugin.enabled ? (plugin.valid ? 'bg-green-500' : 'bg-amber-500') : 'bg-zinc-500'}">
                                    </span>
                                    {plugin.name}
                                </button>
                            {/each}
                        </aside>

                        <Separator orientation="vertical" class="h-auto" />

                        <div class="min-w-0 flex-1">
                            {#if selectedPlugin}
                                {@const status = pluginStatus(selectedPlugin)}
                                <div class="mb-4 flex items-center gap-3">
                                    <h2 class="text-lg font-medium">{selectedPlugin.name}</h2>
                                    <Badge variant={status.variant}>
                                        {status.label}
                                    </Badge>
                                    <span class="text-muted-foreground text-xs">v{selectedPlugin.version}</span>
                                </div>

                                {#if pluginLoading}
                                    <p class="text-muted-foreground text-sm">Loading…</p>
                                {:else}
                                    <form
                                        method="POST"
                                        action="?/updatePlugin"
                                        use:enhance={() => {
                                            pluginSaving = true;
                                            const name = selectedPlugin!.name;
                                            return async ({ result }) => {
                                                pluginSaving = false;
                                                if (result.type === "success") {
                                                    const enabled = (result.data as { enabled?: boolean })?.enabled ?? false;
                                                    const valid = (result.data as { valid?: boolean })?.valid ?? false;
                                                    updatePluginState(name, enabled, valid);
                                                    pluginFields.enabled = String(enabled);
                                                    toast.success("Plugin settings saved");
                                                } else {
                                                    toast.error("Failed to save plugin settings");
                                                }
                                            };
                                        }}>
                                        <input type="hidden" name="plugin" value={selectedPlugin.name} />
                                        <input type="hidden" name="settings" value={JSON.stringify(pluginFields)} />

                                        {#if Array.isArray(selectedPlugin.schema) && selectedPlugin.schema.length > 0}
                                            <div class="space-y-4">
                                                {#each selectedPlugin.schema as field (field.key)}
                                                    {@const f = field as SettingFieldDef}
                                                    <div class="space-y-1.5">
                                                        <Label for="plg-{f.key}">
                                                            {f.label}
                                                            {#if f.required}
                                                                <span class="text-destructive ml-0.5">*</span>
                                                            {/if}
                                                        </Label>
                                                        {#if f.type === "boolean"}
                                                            <Switch
                                                                id="plg-{f.key}"
                                                                checked={pluginFields[f.key] === "true"}
                                                                onCheckedChange={(v) => (pluginFields[f.key] = String(v))} />
                                                        {:else if f.type === "textarea"}
                                                            <textarea
                                                                id="plg-{f.key}"
                                                                rows="3"
                                                                placeholder={f.placeholder ?? f.default_value ?? ""}
                                                                oninput={(e) => (pluginFields[f.key] = (e.currentTarget as HTMLTextAreaElement).value)}
                                                                class="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm shadow-xs focus-visible:ring-1 focus-visible:outline-none">{pluginFields[f.key] ?? ""}</textarea>
                                                        {:else}
                                                            <div class="flex items-center gap-2">
                                                                <Input
                                                                    id="plg-{f.key}"
                                                                    type={f.type === "password" && !revealedFields.has(f.key) ? "password" : f.type === "number" ? "number" : f.type === "url" ? "url" : "text"}
                                                                    placeholder={f.placeholder ?? f.default_value ?? ""}
                                                                    value={pluginFields[f.key] ?? ""}
                                                                    oninput={(e) => (pluginFields[f.key] = (e.currentTarget as HTMLInputElement).value)}
                                                                    class="flex-1" />
                                                                {#if f.type === "password"}
                                                                    <button
                                                                        type="button"
                                                                        class="text-muted-foreground hover:text-foreground shrink-0"
                                                                        aria-label={revealedFields.has(f.key) ? "Hide" : "Reveal"}
                                                                        onclick={() => {
                                                                            if (revealedFields.has(f.key)) {
                                                                                revealedFields = new Set([...revealedFields].filter(k => k !== f.key));
                                                                            } else {
                                                                                revealedFields = new Set([...revealedFields, f.key]);
                                                                            }
                                                                        }}>
                                                                        {#if revealedFields.has(f.key)}
                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                                                        {:else}
                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                                        {/if}
                                                                    </button>
                                                                {/if}
                                                            </div>
                                                        {/if}
                                                        {#if f.description}
                                                            <p class="text-muted-foreground text-xs">{f.description}</p>
                                                        {/if}
                                                    </div>
                                                {/each}
                                            </div>
                                        {:else}
                                            <p class="text-muted-foreground text-sm">
                                                This plugin has no configurable settings.
                                            </p>
                                        {/if}

                                        <div class="mt-6">
                                            <Button type="submit" disabled={pluginSaving}>
                                                {pluginSaving ? "Saving…" : "Save plugin settings"}
                                            </Button>
                                        </div>
                                    </form>
                                {/if}
                            {/if}
                        </div>
                    </div>
                {/if}
            </Tabs.Content>

            <!-- ── Ranking ────────────────────────────────────────────────── -->
            <Tabs.Content value="ranking">
                <form
                    method="POST"
                    action="?/updateRanking"
                    use:enhance={() =>
                        async ({ result }) => {
                            if (result.type === "success") {
                                toast.success("Ranking settings saved");
                                await saveActiveProfileSettings();
                            } else {
                                toast.error("Failed to save ranking settings");
                            }
                        }}>
                    <input type="hidden" name="settings" value={JSON.stringify(rank)} />

                    <div class="space-y-8">
                        {#if qualityProfiles.length > 0 || customProfiles.length > 0}
                            <section class="space-y-3">
                                <div class="space-y-1">
                                    <h2 class="text-base font-semibold">Ranking Profiles</h2>
                                    <p class="text-muted-foreground text-xs">
                                        Enable profiles to scrape and download multiple quality versions simultaneously. Click a profile to load its settings into the editor below.
                                    </p>
                                </div>

                                {#if qualityProfiles.length > 0}
                                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        {#each qualityProfiles as profile}
                                            {@const dbProfile = customProfiles.find((p) => p.name === profile.id)}
                                            {@const enabled = dbProfile?.enabled ?? false}
                                            <button
                                                type="button"
                                                class="group rounded-lg border p-4 text-left transition-colors {enabled ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}"
                                                onclick={() => { toggleProfileEnabled(profile.id, !enabled); applyProfile(profile.settings, profile.id); }}>
                                                <div class="flex items-center justify-between gap-2 mb-1">
                                                    <span class="text-sm font-medium">{profile.label}</span>
                                                    {#if enabled}
                                                        <Badge variant="default" class="text-xs">Enabled</Badge>
                                                    {/if}
                                                </div>
                                                <p class="text-muted-foreground text-xs">{profile.description}</p>
                                            </button>
                                        {/each}
                                    </div>
                                {/if}

                                {#if customProfiles.filter((p) => !p.is_builtin).length > 0}
                                    <h3 class="text-sm font-medium mt-4">Custom Profiles</h3>
                                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        {#each customProfiles.filter((p) => !p.is_builtin) as profile}
                                            <div class="group relative rounded-lg border transition-colors {profile.enabled ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}">
                                                <button
                                                    type="button"
                                                    class="w-full p-4 text-left"
                                                    onclick={() => { toggleProfileEnabled(profile.name, !profile.enabled); applyProfile(profile.settings, profile.name); }}>
                                                    <div class="flex items-center justify-between gap-2 mb-1">
                                                        <span class="text-sm font-medium">{profile.name}</span>
                                                        {#if profile.enabled}
                                                            <Badge variant="default" class="text-xs">Enabled</Badge>
                                                        {/if}
                                                    </div>
                                                    <p class="text-muted-foreground text-xs">
                                                        {new Date(profile.updated_at).toLocaleDateString()}
                                                    </p>
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-label="Delete profile"
                                                    onclick={() => deleteCustomProfile(profile.id, profile.name)}
                                                    class="text-muted-foreground hover:text-destructive absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                                </button>
                                            </div>
                                        {/each}
                                    </div>
                                {/if}
                            </section>

                            <div class="flex items-center gap-2">
                                <Input
                                    placeholder="Profile name…"
                                    bind:value={newProfileName}
                                    onkeydown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveAsProfile(); } }}
                                    class="max-w-xs" />
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={savingProfile || !newProfileName.trim()}
                                    onclick={saveAsProfile}>
                                    {savingProfile ? "Saving…" : "Save as profile"}
                                </Button>
                            </div>

                            <Separator />
                        {/if}

                        {#each Object.entries(rank).filter(([k]) => k !== "quality_profile") as [key, value]}
                            {@const shape = detectShape(value)}

                            {#if shape === "string_array"}
                                <!-- Tag-input list -->
                                <section class="space-y-2 rounded-lg border p-4">
                                    <Label class="text-base font-semibold">{toLabel(key)}</Label>
                                    <div class="flex flex-wrap gap-1.5">
                                        {#each value as string[] as tag, i}
                                            <span class="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs">
                                                {tag}
                                                <button
                                                    type="button"
                                                    onclick={() => removeTag(value as string[], i)}
                                                    class="hover:text-destructive ml-0.5 leading-none">×</button>
                                            </span>
                                        {/each}
                                    </div>
                                    <Input
                                        placeholder="Type and press Enter to add…"
                                        onkeydown={(e) => addTagOnEnter(value as string[], e as KeyboardEvent & { currentTarget: HTMLInputElement })}
                                        class="max-w-xs" />
                                </section>

                            {:else if shape === "bool_object"}
                                <!-- Grid of switches -->
                                <section class="space-y-3">
                                    <h2 class="text-base font-semibold">{toLabel(key)}</h2>
                                    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                        {#each Object.entries(value as Record<string, boolean>) as [subkey, enabled]}
                                            <div class="flex items-center justify-between rounded-lg border p-3">
                                                <Label class="cursor-pointer">{toLabel(subkey)}</Label>
                                                <Switch
                                                    checked={enabled}
                                                    onCheckedChange={(v) => ((rank[key] as Record<string, boolean>)[subkey] = v)} />
                                            </div>
                                        {/each}
                                    </div>
                                </section>

                            {:else if shape === "number_object"}
                                <!-- Grid of number inputs (e.g. resolution tiebreaker ranks) -->
                                <section class="space-y-3">
                                    <h2 class="text-base font-semibold">{toLabel(key)}</h2>
                                    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                        {#each Object.entries(value as Record<string, number>) as [subkey, score]}
                                            <div class="flex items-center justify-between rounded-lg border p-3">
                                                <Label>{toLabel(subkey)}</Label>
                                                <Input
                                                    type="number"
                                                    value={score}
                                                    oninput={(e) => ((rank[key] as Record<string, number>)[subkey] = Number((e.currentTarget as HTMLInputElement).value))}
                                                    class="h-7 w-20 text-right text-sm" />
                                            </div>
                                        {/each}
                                    </div>
                                </section>

                            {:else if shape === "custom_rank_object"}
                                <!-- Custom rank table grouped by parent key -->
                                <details class="rounded-lg border" open>
                                    <summary class="cursor-pointer select-none px-4 py-3 text-sm font-medium">
                                        {toLabel(key)}
                                    </summary>
                                    <div class="divide-y px-4 pb-2">
                                        {#each Object.entries(value as Record<string, { fetch: boolean; rank?: number | null; default?: number }>) as [attr, cr]}
                                            <div class="flex items-center gap-4 py-2.5">
                                                <span class="w-28 shrink-0 text-sm">{toLabel(attr)}</span>
                                                <div class="flex items-center gap-1.5">
                                                    <Switch
                                                        checked={cr.fetch}
                                                        onCheckedChange={(v) => (cr.fetch = v)} />
                                                    <span class="text-muted-foreground text-xs">Fetch</span>
                                                </div>
                                                <Input
                                                    type="number"
                                                    value={cr.rank ?? cr.default ?? 0}
                                                    oninput={(e) => {
                                                        const raw = (e.currentTarget as HTMLInputElement).value;
                                                        cr.rank = raw === "" ? null : Number(raw);
                                                    }}
                                                    class="h-7 w-24 text-sm" />
                                                <span class="text-muted-foreground text-xs">{cr.rank == null ? "default" : "Score"}</span>
                                            </div>
                                        {/each}
                                    </div>
                                </details>

                            {:else if shape === "settings_section"}
                                <!-- Generic nested section: booleans → switches, numbers → inputs, arrays → tag inputs, custom_rank_object → rank table -->
                                <section class="space-y-3">
                                    <h2 class="text-base font-semibold">{toLabel(key)}</h2>
                                    <div class="space-y-3">
                                        {#each Object.entries(value as Record<string, unknown>) as [subkey, subval]}
                                            {@const subshape = detectShape(subval)}
                                            {#if subshape === "custom_rank_object"}
                                                <!-- e.g. custom_ranks.audio, custom_ranks.quality, etc. -->
                                                <details class="rounded-lg border" open>
                                                    <summary class="cursor-pointer select-none px-4 py-3 text-sm font-semibold">
                                                        {toLabel(subkey)}
                                                    </summary>
                                                    <div class="divide-y px-4 pb-2">
                                                        {#each Object.entries(subval as Record<string, { fetch: boolean; rank?: number | null; default?: number }>) as [attr, cr]}
                                                            <div class="flex items-center gap-4 py-2.5">
                                                                <span class="w-36 shrink-0 text-sm">{toLabel(attr)}</span>
                                                                <div class="flex items-center gap-1.5">
                                                                    <Switch
                                                                        checked={cr.fetch}
                                                                        onCheckedChange={(v) => (cr.fetch = v)} />
                                                                    <span class="text-muted-foreground text-xs">Fetch</span>
                                                                </div>
                                                                <div class="flex items-center gap-1.5">
                                                                    <Input
                                                                        type="number"
                                                                        value={cr.rank ?? cr.default ?? 0}
                                                                        oninput={(e) => {
                                                                            const raw = (e.currentTarget as HTMLInputElement).value;
                                                                            cr.rank = raw === "" ? null : Number(raw);
                                                                        }}
                                                                        class="h-7 w-24 text-sm" />
                                                                    <span class="text-muted-foreground text-xs">{cr.rank == null ? "default" : "Score"}</span>
                                                                </div>
                                                            </div>
                                                        {/each}
                                                    </div>
                                                </details>
                                            {:else if subshape === "boolean"}
                                                <div class="flex items-center justify-between rounded-lg border p-3">
                                                    <Label>{toLabel(subkey)}</Label>
                                                    <Switch
                                                        checked={!!subval}
                                                        onCheckedChange={(v) => ((rank[key] as Record<string, unknown>)[subkey] = v)} />
                                                </div>
                                            {:else if subshape === "number"}
                                                <div class="flex items-center gap-4 rounded-lg border p-3">
                                                    <Label class="w-48 shrink-0">{toLabel(subkey)}</Label>
                                                    <Input
                                                        type="number"
                                                        step="any"
                                                        value={subval as number}
                                                        oninput={(e) => ((rank[key] as Record<string, unknown>)[subkey] = Number((e.currentTarget as HTMLInputElement).value))}
                                                        class="max-w-[160px]" />
                                                </div>
                                            {:else if subshape === "string_array"}
                                                <div class="space-y-2 rounded-lg border p-3">
                                                    <Label>{toLabel(subkey)}</Label>
                                                    <div class="flex flex-wrap gap-1">
                                                        {#each subval as string[] as tag, i}
                                                            <span class="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
                                                                {tag}
                                                                <button
                                                                    type="button"
                                                                    onclick={() => removeTag((rank[key] as Record<string, string[]>)[subkey], i)}
                                                                    class="hover:text-destructive ml-0.5 leading-none">×</button>
                                                            </span>
                                                        {/each}
                                                    </div>
                                                    <Input
                                                        placeholder="Type and press Enter…"
                                                        onkeydown={(e) => addTagOnEnter((rank[key] as Record<string, string[]>)[subkey], e as KeyboardEvent & { currentTarget: HTMLInputElement })}
                                                        class="h-8 max-w-xs text-sm" />
                                                </div>
                                            {/if}
                                        {/each}
                                    </div>
                                </section>

                            {:else if shape === "boolean" || shape === "number"}
                                <!-- scalar top-level fields -->
                                {#if shape === "boolean"}
                                    <div class="flex items-center justify-between rounded-lg border p-4">
                                        <Label>{toLabel(key)}</Label>
                                        <Switch
                                            checked={!!value}
                                            onCheckedChange={(v) => (rank[key] = v)} />
                                    </div>
                                {:else if shape === "number"}
                                    <div class="space-y-1.5">
                                        <Label>{toLabel(key)}</Label>
                                        <Input
                                            type="number"
                                            value={value as number}
                                            oninput={(e) => (rank[key] = Number((e.currentTarget as HTMLInputElement).value))}
                                            class="max-w-xs" />
                                    </div>
                                {/if}
                            {/if}

                            {#if shape !== "unknown"}
                                <Separator />
                            {/if}
                        {/each}

                        <Button type="submit">Save ranking settings</Button>
                    </div>
                </form>
            </Tabs.Content>
        </Tabs.Root>
    </div>
</PageShell>
