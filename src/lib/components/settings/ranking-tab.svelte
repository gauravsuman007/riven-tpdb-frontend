<script lang="ts">
    import { enhance } from "$app/forms";
    import { toast } from "svelte-sonner";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import { Separator } from "$lib/components/ui/separator/index.js";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import { detectShape, toLabel } from "./helpers";
    import type { CustomProfile, QualityProfile } from "./types";

    let {
        rank = $bindable(),
        qualityProfiles,
        customProfiles = $bindable(),
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
</script>

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
                        Enable profiles to scrape and download multiple quality versions
                        simultaneously. Click a profile to load its settings into the editor below.
                    </p>
                </div>

                {#if qualityProfiles.length > 0}
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {#each qualityProfiles as profile}
                            {@const dbProfile = customProfiles.find((p) => p.name === profile.id)}
                            {@const enabled = dbProfile?.enabled ?? false}
                            <button
                                type="button"
                                class="group rounded-lg border p-4 text-left transition-colors {enabled
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:bg-muted/40'}"
                                onclick={() => {
                                    toggleProfileEnabled(profile.id, !enabled);
                                    applyProfile(profile.settings, profile.id);
                                }}>
                                <div class="mb-1 flex items-center justify-between gap-2">
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
                    <h3 class="mt-4 text-sm font-medium">Custom Profiles</h3>
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {#each customProfiles.filter((p) => !p.is_builtin) as profile}
                            <div
                                class="group relative rounded-lg border transition-colors {profile.enabled
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:bg-muted/40'}">
                                <button
                                    type="button"
                                    class="w-full p-4 text-left"
                                    onclick={() => {
                                        toggleProfileEnabled(profile.name, !profile.enabled);
                                        applyProfile(profile.settings, profile.name);
                                    }}>
                                    <div class="mb-1 flex items-center justify-between gap-2">
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
                                    class="text-muted-foreground hover:text-destructive absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
                                    Delete
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
                    onkeydown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            saveAsProfile();
                        }
                    }}
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
                <section class="space-y-2 rounded-lg border p-4">
                    <Label class="text-base font-semibold">{toLabel(key)}</Label>
                    <div class="flex flex-wrap gap-1.5">
                        {#each value as string[] as tag, i}
                            <span
                                class="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs">
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
                        onkeydown={(e) =>
                            addTagOnEnter(
                                value as string[],
                                e as KeyboardEvent & { currentTarget: HTMLInputElement }
                            )}
                        class="max-w-xs" />
                </section>
            {:else if shape === "bool_object"}
                <section class="space-y-3">
                    <h2 class="text-base font-semibold">{toLabel(key)}</h2>
                    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {#each Object.entries(value as Record<string, boolean>) as [subkey, enabled]}
                            <div class="flex items-center justify-between rounded-lg border p-3">
                                <Label class="cursor-pointer">{toLabel(subkey)}</Label>
                                <Switch
                                    checked={enabled}
                                    onCheckedChange={(v) =>
                                        ((rank[key] as Record<string, boolean>)[subkey] = v)} />
                            </div>
                        {/each}
                    </div>
                </section>
            {:else if shape === "number_object"}
                <section class="space-y-3">
                    <h2 class="text-base font-semibold">{toLabel(key)}</h2>
                    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {#each Object.entries(value as Record<string, number>) as [subkey, score]}
                            <div class="flex items-center justify-between rounded-lg border p-3">
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
                    <summary class="cursor-pointer px-4 py-3 text-sm font-medium select-none">
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
                                <span class="text-muted-foreground text-xs">
                                    {cr.rank == null ? "default" : "Score"}
                                </span>
                            </div>
                        {/each}
                    </div>
                </details>
            {:else if shape === "settings_section"}
                <section class="space-y-3">
                    <h2 class="text-base font-semibold">{toLabel(key)}</h2>
                    <div class="space-y-3">
                        {#each Object.entries(value as Record<string, unknown>) as [subkey, subval]}
                            {@const subshape = detectShape(subval)}
                            {#if subshape === "custom_rank_object"}
                                <details class="rounded-lg border" open>
                                    <summary
                                        class="cursor-pointer px-4 py-3 text-sm font-semibold select-none">
                                        {toLabel(subkey)}
                                    </summary>
                                    <div class="divide-y px-4 pb-2">
                                        {#each Object.entries(subval as Record<string, { fetch: boolean; rank?: number | null; default?: number }>) as [attr, cr]}
                                            <div class="flex items-center gap-4 py-2.5">
                                                <span class="w-36 shrink-0 text-sm"
                                                    >{toLabel(attr)}</span>
                                                <div class="flex items-center gap-1.5">
                                                    <Switch
                                                        checked={cr.fetch}
                                                        onCheckedChange={(v) => (cr.fetch = v)} />
                                                    <span class="text-muted-foreground text-xs"
                                                        >Fetch</span>
                                                </div>
                                                <div class="flex items-center gap-1.5">
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
                                                    <span class="text-muted-foreground text-xs">
                                                        {cr.rank == null ? "default" : "Score"}
                                                    </span>
                                                </div>
                                            </div>
                                        {/each}
                                    </div>
                                </details>
                            {:else if subshape === "boolean"}
                                <div
                                    class="flex items-center justify-between rounded-lg border p-3">
                                    <Label>{toLabel(subkey)}</Label>
                                    <Switch
                                        checked={!!subval}
                                        onCheckedChange={(v) =>
                                            ((rank[key] as Record<string, unknown>)[subkey] = v)} />
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
                                        class="max-w-[160px]" />
                                </div>
                            {:else if subshape === "string_array"}
                                <div class="space-y-2 rounded-lg border p-3">
                                    <Label>{toLabel(subkey)}</Label>
                                    <div class="flex flex-wrap gap-1">
                                        {#each subval as string[] as tag, i}
                                            <span
                                                class="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
                                                {tag}
                                                <button
                                                    type="button"
                                                    onclick={() =>
                                                        removeTag(
                                                            (rank[key] as Record<string, string[]>)[
                                                                subkey
                                                            ],
                                                            i
                                                        )}
                                                    class="hover:text-destructive ml-0.5 leading-none">
                                                    ×
                                                </button>
                                            </span>
                                        {/each}
                                    </div>
                                    <Input
                                        placeholder="Type and press Enter…"
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
                        <Switch checked={!!value} onCheckedChange={(v) => (rank[key] = v)} />
                    </div>
                {:else}
                    <div class="space-y-1.5">
                        <Label>{toLabel(key)}</Label>
                        <Input
                            type="number"
                            value={value as number}
                            oninput={(e) =>
                                (rank[key] = Number((e.currentTarget as HTMLInputElement).value))}
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
