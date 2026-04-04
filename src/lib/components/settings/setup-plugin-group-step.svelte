<script lang="ts">
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Card from "$lib/components/ui/card/index.js";
    import SetupPluginCard from "./setup-plugin-card.svelte";
    import type { SetupPluginSection } from "./types";

    let {
        section,
        setField,
        toggleReveal,
        savePlugin
    }: {
        section: SetupPluginSection;
        setField: (pluginName: string, fieldKey: string, value: string) => void;
        toggleReveal: (pluginName: string, fieldKey: string) => void;
        savePlugin: (pluginName: string) => void;
    } = $props();

    let activePluginName = $state<string | null>(null);

    $effect(() => {
        const preferred =
            section.plugins.find((pluginView) => pluginView.plugin.enabled)?.plugin.name ??
            section.plugins[0]?.plugin.name ??
            null;

        if (
            !activePluginName ||
            !section.plugins.some((entry) => entry.plugin.name === activePluginName)
        ) {
            activePluginName = preferred;
        }
    });

    const activePlugin = $derived.by(
        () =>
            section.plugins.find((pluginView) => pluginView.plugin.name === activePluginName) ??
            null
    );
</script>

<div class="space-y-8">
    {#if section.plugins.length === 0}
        <div class="mx-auto max-w-2xl rounded-3xl border border-dashed p-8 text-center">
            <p class="text-muted-foreground text-sm md:text-base">{section.emptyMessage}</p>
        </div>
    {:else}
        <div class="mx-auto grid w-full max-w-4xl gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {#each section.plugins as pluginView (pluginView.plugin.name)}
                <Card.Root
                    class="gap-4 rounded-3xl py-0 transition-colors {pluginView.plugin.name ===
                    activePluginName
                        ? 'border-white/14 bg-white/4'
                        : 'bg-background/40 hover:bg-background/65'}">
                    <Card.Header class="px-5 pt-5 pb-0">
                        <Card.Title class="text-lg capitalize">{pluginView.plugin.name}</Card.Title>
                    </Card.Header>
                    <Card.Content class="px-5 pt-0 pb-0">
                        <p class="text-muted-foreground text-sm">
                            v{pluginView.plugin.version}
                            {#if pluginView.badge.label !== "Disabled"}
                                · {pluginView.badge.label.toLowerCase()}{/if}
                        </p>
                    </Card.Content>
                    <Card.Footer class="px-5 pt-0 pb-5">
                        <Button
                            type="button"
                            variant="outline"
                            class="w-full"
                            onclick={() => (activePluginName = pluginView.plugin.name)}>
                            {pluginView.plugin.name === activePluginName ? "Selected" : "Configure"}
                        </Button>
                    </Card.Footer>
                </Card.Root>
            {/each}
        </div>

        {#if activePlugin}
            <div class="mx-auto w-full max-w-4xl">
                <SetupPluginCard
                    plugin={activePlugin.plugin}
                    fields={activePlugin.fields}
                    loading={activePlugin.loading}
                    saving={activePlugin.saving}
                    reveals={activePlugin.reveals}
                    {setField}
                    {toggleReveal}
                    {savePlugin} />
            </div>
        {/if}
    {/if}

    {#if section.plugins.length > 1}
        <div class="mx-auto max-w-2xl">
            <p class="text-muted-foreground text-sm">Choose one provider to configure.</p>
        </div>
    {/if}
</div>
