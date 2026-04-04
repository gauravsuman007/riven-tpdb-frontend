<script lang="ts">
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import SetupGeneralField from "./setup-general-field.svelte";
    import type { QualityProfile, SettingFieldDef } from "./types";

    type GeneralSection = {
        title: string;
        description: string;
        keys: string[];
    };

    let {
        qualityProfiles,
        isProfileEnabled,
        toggleProfileEnabled,
        generalSections,
        generalFieldsFor,
        general = $bindable(),
        saveGeneralSettings
    }: {
        qualityProfiles: QualityProfile[];
        isProfileEnabled: (profileId: string) => boolean;
        toggleProfileEnabled: (name: string, enabled: boolean) => void;
        generalSections: GeneralSection[];
        generalFieldsFor: (sectionKeys: string[]) => SettingFieldDef[];
        general: Record<string, unknown>;
        saveGeneralSettings: () => void;
    } = $props();
</script>

<div class="space-y-8">
    <div>
        <h2 class="text-2xl font-semibold">Playback and Quality Defaults</h2>
        <p class="text-muted-foreground mt-2 max-w-3xl text-sm">
            Choose the profiles you want active, then set the runtime guardrails that affect retry
            timing, language defaults, and bitrate caps.
        </p>
    </div>

    <div class="space-y-6">
        <div>
            <h3 class="text-lg font-semibold">Quality Profiles</h3>
            <p class="text-muted-foreground mt-1 text-sm">
                These are the built-in `riven-rs` profiles. Enable one or more depending on whether
                you want a single preferred quality or multiple versions scraped in parallel.
            </p>
        </div>
        <div class="grid gap-4 md:grid-cols-3">
            {#each qualityProfiles as profile}
                {@const enabled = isProfileEnabled(profile.id)}
                <button
                    type="button"
                    onclick={() => toggleProfileEnabled(profile.id, !enabled)}
                    class="rounded-2xl border p-5 text-left transition-colors {enabled
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/40'}">
                    <div class="flex items-center justify-between gap-3">
                        <h4 class="font-semibold">{profile.label}</h4>
                        {#if enabled}
                            <Badge variant="default">Enabled</Badge>
                        {/if}
                    </div>
                    <p class="text-muted-foreground mt-3 text-sm">{profile.description}</p>
                </button>
            {/each}
        </div>
    </div>

    <div class="space-y-6">
        {#each generalSections as section}
            <div class="space-y-4">
                <div>
                    <h3 class="text-lg font-semibold">{section.title}</h3>
                    <p class="text-muted-foreground mt-1 text-sm">{section.description}</p>
                </div>
                <div class="grid gap-4 lg:grid-cols-2">
                    {#each generalFieldsFor(section.keys) as field (field.key)}
                        <SetupGeneralField {field} bind:general />
                    {/each}
                </div>
            </div>
        {/each}
    </div>

    <div class="flex justify-end">
        <Button type="button" onclick={saveGeneralSettings}>Save preferences</Button>
    </div>
</div>
