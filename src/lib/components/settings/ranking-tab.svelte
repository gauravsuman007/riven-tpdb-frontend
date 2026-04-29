<script lang="ts">
    import { untrack } from "svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import { Separator } from "$lib/components/ui/separator/index.js";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import { detectShape, settingsSwitchClass, toLabel } from "./helpers";
    import type { CustomProfile, QualityProfile } from "./types";

    type CustomRank = { fetch: boolean; rank?: number | null; default?: number };

    let {
        rank = $bindable(),
        qualityProfiles,
        customProfiles = $bindable(),
        activeProfileName = $bindable(),
        newProfileName = $bindable(),
        savingProfile = $bindable(),
        saveAsProfile,
        toggleProfileEnabled,
        applyProfile,
        deleteCustomProfile,
        saveActiveProfileSettings,
        removeTag,
        addTagOnEnter
    }: {
        rank: Record<string, unknown>;
        qualityProfiles: QualityProfile[];
        customProfiles: CustomProfile[];
        activeProfileName: string | null;
        newProfileName: string;
        savingProfile: boolean;
        saveAsProfile: () => Promise<void>;
        toggleProfileEnabled: (name: string, enabled: boolean) => Promise<void>;
        applyProfile: (settings: Record<string, unknown>, profileName?: string) => void;
        deleteCustomProfile: (id: number, name: string) => Promise<void>;
        saveActiveProfileSettings: () => Promise<void>;
        removeTag: (arr: string[], index: number) => void;
        addTagOnEnter: (
            arr: string[],
            e: KeyboardEvent & { currentTarget: HTMLInputElement }
        ) => void;
    } = $props();

    let customRankTabs = $state<Record<string, string>>({});
    let savedRankJson = $state("");
    let savingRanking = $state(false);

    const editorSections = $derived(Object.entries(rank).filter(([k]) => k !== "quality_profile"));
    const customProfileCount = $derived(
        customProfiles.filter((profile) => !profile.is_builtin).length
    );
    const activeProfileLabel = $derived(
        qualityProfiles.find((profile) => profile.id === activeProfileName)?.label ??
            activeProfileName ??
            "Global ranking"
    );
    const activeProfileDescription = $derived(
        qualityProfiles.find((profile) => profile.id === activeProfileName)?.description ??
            (activeProfileName
                ? "Custom ranking rules for this profile."
                : "Default ranking rules used when no profile override is active.")
    );
    const rankJson = $derived(JSON.stringify(rank));
    const hasUnsavedChanges = $derived(savedRankJson !== "" && rankJson !== savedRankJson);
    const saveLabel = $derived(activeProfileName ? "Save profile" : "Save");

    $effect(() => {
        void activeProfileName;
        savedRankJson = untrack(() => JSON.stringify(rank));
    });

    function profileEnabled(name: string) {
        return customProfiles.find((profile) => profile.name === name)?.enabled ?? false;
    }

    function selectProfile(settings: Record<string, unknown>, profileName?: string) {
        applyProfile(settings, profileName);
    }

    async function setProfileEnabled(name: string, enabled: boolean) {
        await toggleProfileEnabled(name, enabled);
    }

    function customRankEntries(value: unknown) {
        return Object.entries(value as Record<string, CustomRank>);
    }

    function customRankSummary(value: unknown) {
        const entries = customRankEntries(value);
        const fetched = entries.filter(([, cr]) => cr.fetch).length;
        return `${fetched}/${entries.length} fetch`;
    }

    function activeCustomRankTab(key: string, sections: [string, unknown][]) {
        const selected = customRankTabs[key];
        return sections.some(([sectionKey]) => sectionKey === selected)
            ? selected
            : (sections[0]?.[0] ?? "");
    }

    function discardChanges() {
        if (!savedRankJson) return;
        rank = JSON.parse(savedRankJson) as Record<string, unknown>;
    }

    async function saveRankingSettings() {
        if (!hasUnsavedChanges || savingRanking) return;

        savingRanking = true;
        try {
            await saveActiveProfileSettings();
            savedRankJson = JSON.stringify(rank);
            toast.success("Changes saved");
        } catch {
            toast.error("Couldn't save changes");
        } finally {
            savingRanking = false;
        }
    }
</script>

<div>
    <div class="space-y-8">
        {#if qualityProfiles.length > 0 || customProfiles.length > 0}
            <section class="space-y-4">
                <div>
                    <h2 class="text-lg font-semibold">Ranking Profiles</h2>
                </div>

                {#if qualityProfiles.length > 0}
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {#each qualityProfiles as profile (profile.id)}
                            {@const enabled = profileEnabled(profile.id)}
                            {@const selected = activeProfileName === profile.id}
                            <div
                                class="group rounded-lg border p-3 transition-colors {selected
                                    ? 'border-primary bg-primary/10 shadow-sm'
                                    : enabled
                                      ? 'border-primary/50 bg-primary/5 hover:bg-primary/10'
                                      : 'border-border hover:bg-muted/40'}">
                                <button
                                    type="button"
                                    class="w-full text-left"
                                    aria-pressed={selected}
                                    onclick={() => selectProfile(profile.settings, profile.id)}>
                                    <div class="flex items-start justify-between gap-3">
                                        <div class="min-w-0">
                                            <span class="block truncate text-sm font-semibold"
                                                >{profile.label}</span>
                                            <span
                                                class="text-muted-foreground mt-1 line-clamp-2 block text-xs">
                                                {profile.description}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                                <div
                                    class="mt-3 flex items-center justify-between border-t pt-3 text-xs">
                                    <span class="text-muted-foreground">
                                        {selected ? "Editing" : "Edit"}
                                    </span>
                                    <Switch
                                        class={settingsSwitchClass}
                                        checked={enabled}
                                        onCheckedChange={(next) =>
                                            setProfileEnabled(profile.id, next)} />
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}

                {#if customProfileCount > 0}
                    <h3 class="pt-1 text-sm font-medium">Custom Profiles</h3>
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {#each customProfiles.filter((p) => !p.is_builtin) as profile (profile.name)}
                            {@const selected = activeProfileName === profile.name}
                            <div
                                class="group relative rounded-lg border transition-colors {selected
                                    ? 'border-primary bg-primary/10 shadow-sm'
                                    : profile.enabled
                                      ? 'border-primary/50 bg-primary/5 hover:bg-primary/10'
                                      : 'border-border hover:bg-muted/40'}">
                                <button
                                    type="button"
                                    class="w-full p-3 pb-0 text-left"
                                    aria-pressed={selected}
                                    onclick={() => selectProfile(profile.settings, profile.name)}>
                                    <div class="flex items-start justify-between gap-3">
                                        <div class="min-w-0">
                                            <span class="block truncate text-sm font-semibold">
                                                {profile.name}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                                <div
                                    class="mx-3 mt-3 flex items-center justify-between border-t pt-3 pb-3 text-xs">
                                    <span class="flex items-center gap-3">
                                        <span class="text-muted-foreground">
                                            {selected ? "Editing" : "Edit"}
                                        </span>
                                        <button
                                            type="button"
                                            onclick={() =>
                                                deleteCustomProfile(profile.id, profile.name)}
                                            class="text-muted-foreground hover:text-destructive">
                                            Delete
                                        </button>
                                    </span>
                                    <Switch
                                        class={settingsSwitchClass}
                                        checked={profile.enabled}
                                        onCheckedChange={(next) =>
                                            setProfileEnabled(profile.name, next)} />
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </section>

            <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Label class="text-sm font-medium sm:w-28">New profile</Label>
                <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                        placeholder="Profile name..."
                        bind:value={newProfileName}
                        onkeydown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                saveAsProfile();
                            }
                        }}
                        class="w-full sm:w-56" />
                    <Button
                        type="button"
                        variant="outline"
                        disabled={savingProfile || !newProfileName.trim()}
                        onclick={saveAsProfile}>
                        {savingProfile ? "Saving..." : "Create"}
                    </Button>
                </div>
            </div>

            <Separator />
        {/if}

        <div
            class="bg-background/95 sticky top-4 z-10 rounded-lg border p-4 shadow-sm backdrop-blur">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                    <h2 class="truncate text-lg font-semibold">{activeProfileLabel}</h2>
                    <p class="text-muted-foreground mt-1 text-sm">{activeProfileDescription}</p>
                </div>
                <div class="flex shrink-0 flex-wrap items-center gap-2">
                    <span
                        class="rounded-md border px-2.5 py-1 text-xs {hasUnsavedChanges
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground'}">
                        {hasUnsavedChanges ? "Unsaved changes" : "Saved"}
                    </span>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={!hasUnsavedChanges || savingRanking}
                        onclick={discardChanges}>
                        Discard
                    </Button>
                    <Button
                        type="button"
                        disabled={!hasUnsavedChanges || savingRanking}
                        onclick={saveRankingSettings}>
                        {savingRanking ? "Saving..." : saveLabel}
                    </Button>
                </div>
            </div>
        </div>

        <div class="grid gap-4">
            {#each editorSections as [key, value] (key)}
                {@const shape = detectShape(value)}

                {#if shape === "string_array"}
                    <section class="space-y-3 rounded-lg border p-4">
                        <div class="flex items-center justify-between gap-3">
                            <Label class="text-base font-semibold">{toLabel(key)}</Label>
                            <span class="text-muted-foreground text-xs"
                                >{(value as string[]).length} tags</span>
                        </div>
                        <div class="flex flex-wrap gap-1.5">
                            {#each value as string[] as tag, i (`${tag}-${i}`)}
                                <span
                                    class="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs">
                                    {tag}
                                    <button
                                        type="button"
                                        onclick={() => removeTag(value as string[], i)}
                                        class="hover:text-destructive ml-0.5 leading-none"
                                        >×</button>
                                </span>
                            {/each}
                        </div>
                        <Input
                            placeholder="Type and press Enter to add..."
                            onkeydown={(e) =>
                                addTagOnEnter(
                                    value as string[],
                                    e as KeyboardEvent & { currentTarget: HTMLInputElement }
                                )}
                            class="max-w-xs" />
                    </section>
                {:else if shape === "bool_object"}
                    <section class="space-y-3 rounded-lg border p-4">
                        <h2 class="text-base font-semibold">{toLabel(key)}</h2>
                        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {#each Object.entries(value as Record<string, boolean>) as [subkey, enabled] (subkey)}
                                <div
                                    class="bg-muted/30 flex items-center justify-between rounded-lg p-3">
                                    <Label class="cursor-pointer">{toLabel(subkey)}</Label>
                                    <Switch
                                        class={settingsSwitchClass}
                                        checked={enabled}
                                        onCheckedChange={(v) =>
                                            ((rank[key] as Record<string, boolean>)[subkey] = v)} />
                                </div>
                            {/each}
                        </div>
                    </section>
                {:else if shape === "number_object"}
                    <section class="space-y-3 rounded-lg border p-4">
                        <h2 class="text-base font-semibold">{toLabel(key)}</h2>
                        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {#each Object.entries(value as Record<string, number>) as [subkey, score] (subkey)}
                                <div
                                    class="bg-muted/30 flex items-center justify-between rounded-lg p-3">
                                    <Label>{toLabel(subkey)}</Label>
                                    <Input
                                        type="number"
                                        value={score}
                                        oninput={(e) =>
                                            ((rank[key] as Record<string, number>)[subkey] = Number(
                                                (e.currentTarget as HTMLInputElement).value
                                            ))}
                                        class="h-7 w-20 text-right text-sm" />
                                </div>
                            {/each}
                        </div>
                    </section>
                {:else if shape === "custom_rank_object"}
                    <details class="rounded-lg border" open>
                        <summary class="cursor-pointer px-4 py-3 select-none">
                            <span class="text-base font-semibold">{toLabel(key)}</span>
                        </summary>
                        <div class="px-4 pb-4">
                            <div
                                class="text-muted-foreground mb-2 grid grid-cols-[minmax(0,1fr)_auto_6rem] gap-3 px-3 text-xs">
                                <span>Attribute</span>
                                <span>Fetch</span>
                                <span>Score</span>
                            </div>
                            <div class="grid gap-2 md:grid-cols-2">
                                {#each customRankEntries(value) as [attr, cr] (attr)}
                                    <div
                                        class="bg-muted/30 grid grid-cols-[minmax(0,1fr)_auto_6rem] items-center gap-3 rounded-lg px-3 py-2">
                                        <span class="min-w-0 truncate text-sm"
                                            >{toLabel(attr)}</span>
                                        <Switch
                                            class={settingsSwitchClass}
                                            checked={cr.fetch}
                                            onCheckedChange={(v) => (cr.fetch = v)} />
                                        <Input
                                            type="number"
                                            value={cr.rank ?? cr.default ?? 0}
                                            oninput={(e) => {
                                                const raw = (e.currentTarget as HTMLInputElement)
                                                    .value;
                                                cr.rank = raw === "" ? null : Number(raw);
                                            }}
                                            class="h-7 w-24 text-sm" />
                                    </div>
                                {/each}
                            </div>
                        </div>
                    </details>
                {:else if shape === "settings_section"}
                    {@const sectionEntries = Object.entries(value as Record<string, unknown>)}
                    {@const customRankSections = sectionEntries.filter(
                        ([, subval]) => detectShape(subval) === "custom_rank_object"
                    )}
                    {@const activeRankSection = activeCustomRankTab(key, customRankSections)}
                    <section class="space-y-3">
                        <h2 class="text-base font-semibold">{toLabel(key)}</h2>

                        {#if customRankSections.length > 0}
                            <div class="rounded-lg border">
                                <div class="flex gap-1 overflow-x-auto border-b p-1">
                                    {#each customRankSections as [subkey, subval] (subkey)}
                                        <button
                                            type="button"
                                            class="shrink-0 rounded-md px-3 py-2 text-left text-xs transition-colors {activeRankSection ===
                                            subkey
                                                ? 'bg-primary text-primary-foreground'
                                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                                            onclick={() => (customRankTabs[key] = subkey)}>
                                            <span class="block font-medium">{toLabel(subkey)}</span>
                                            <span class="block opacity-75"
                                                >{customRankSummary(subval)}</span>
                                        </button>
                                    {/each}
                                </div>

                                {#each customRankSections as [subkey, subval] (subkey)}
                                    {#if subkey === activeRankSection}
                                        <div class="p-3">
                                            <div
                                                class="text-muted-foreground mb-2 grid grid-cols-[minmax(0,1fr)_auto_6rem] gap-3 px-3 text-xs">
                                                <span>Attribute</span>
                                                <span>Fetch</span>
                                                <span>Score</span>
                                            </div>
                                            <div class="grid gap-2 md:grid-cols-2">
                                                {#each customRankEntries(subval) as [attr, cr] (attr)}
                                                    <div
                                                        class="bg-muted/30 grid grid-cols-[minmax(0,1fr)_auto_6rem] items-center gap-3 rounded-lg px-3 py-2">
                                                        <span class="min-w-0 truncate text-sm">
                                                            {toLabel(attr)}
                                                        </span>
                                                        <Switch
                                                            class={settingsSwitchClass}
                                                            checked={cr.fetch}
                                                            onCheckedChange={(v) =>
                                                                (cr.fetch = v)} />
                                                        <Input
                                                            type="number"
                                                            value={cr.rank ?? cr.default ?? 0}
                                                            oninput={(e) => {
                                                                const raw = (
                                                                    e.currentTarget as HTMLInputElement
                                                                ).value;
                                                                cr.rank =
                                                                    raw === "" ? null : Number(raw);
                                                            }}
                                                            class="h-7 w-24 text-sm" />
                                                    </div>
                                                {/each}
                                            </div>
                                        </div>
                                    {/if}
                                {/each}
                            </div>
                        {/if}

                        <div class="space-y-3">
                            {#each sectionEntries as [subkey, subval] (subkey)}
                                {@const subshape = detectShape(subval)}
                                {#if subshape === "boolean"}
                                    <div
                                        class="flex items-center justify-between rounded-lg border p-3">
                                        <Label>{toLabel(subkey)}</Label>
                                        <Switch
                                            class={settingsSwitchClass}
                                            checked={!!subval}
                                            onCheckedChange={(v) =>
                                                ((rank[key] as Record<string, unknown>)[subkey] =
                                                    v)} />
                                    </div>
                                {:else if subshape === "number"}
                                    <div class="flex items-center gap-4 rounded-lg border p-3">
                                        <Label class="w-48 shrink-0">{toLabel(subkey)}</Label>
                                        <Input
                                            type="number"
                                            step="any"
                                            value={subval as number}
                                            oninput={(e) =>
                                                ((rank[key] as Record<string, unknown>)[subkey] =
                                                    Number(
                                                        (e.currentTarget as HTMLInputElement).value
                                                    ))}
                                            class="max-w-40" />
                                    </div>
                                {:else if subshape === "string_array"}
                                    <div class="space-y-2 rounded-lg border p-3">
                                        <Label>{toLabel(subkey)}</Label>
                                        <div class="flex flex-wrap gap-1">
                                            {#each subval as string[] as tag, i (`${tag}-${i}`)}
                                                <span
                                                    class="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
                                                    {tag}
                                                    <button
                                                        type="button"
                                                        onclick={() =>
                                                            removeTag(
                                                                (
                                                                    rank[key] as Record<
                                                                        string,
                                                                        string[]
                                                                    >
                                                                )[subkey],
                                                                i
                                                            )}
                                                        class="hover:text-destructive ml-0.5 leading-none">
                                                        ×
                                                    </button>
                                                </span>
                                            {/each}
                                        </div>
                                        <Input
                                            placeholder="Type and press Enter..."
                                            onkeydown={(e) =>
                                                addTagOnEnter(
                                                    (rank[key] as Record<string, string[]>)[subkey],
                                                    e as KeyboardEvent & {
                                                        currentTarget: HTMLInputElement;
                                                    }
                                                )}
                                            class="h-8 max-w-xs text-sm" />
                                    </div>
                                {/if}
                            {/each}
                        </div>
                    </section>
                {:else if shape === "boolean" || shape === "number"}
                    {#if shape === "boolean"}
                        <div class="flex items-center justify-between rounded-lg border p-4">
                            <Label>{toLabel(key)}</Label>
                            <Switch
                                class={settingsSwitchClass}
                                checked={!!value}
                                onCheckedChange={(v) => (rank[key] = v)} />
                        </div>
                    {:else}
                        <div class="space-y-1.5">
                            <Label>{toLabel(key)}</Label>
                            <Input
                                type="number"
                                value={value as number}
                                oninput={(e) =>
                                    (rank[key] = Number(
                                        (e.currentTarget as HTMLInputElement).value
                                    ))}
                                class="max-w-xs" />
                        </div>
                    {/if}
                {/if}
            {/each}
        </div>
    </div>
</div>
