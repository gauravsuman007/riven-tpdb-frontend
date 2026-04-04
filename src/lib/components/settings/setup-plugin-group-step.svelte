<script lang="ts">
    import SetupPluginCard from "./setup-plugin-card.svelte";
    import type { PluginInfo } from "./types";

    let {
        title,
        description,
        plugins,
        emptyMessage,
        getFields,
        getLoading,
        getSaving,
        getReveals,
        getBadge,
        fieldKey,
        setField,
        toggleReveal,
        savePlugin
    }: {
        title: string;
        description: string;
        plugins: PluginInfo[];
        emptyMessage: string;
        getFields: (pluginName: string) => Record<string, string>;
        getLoading: (pluginName: string) => boolean;
        getSaving: (pluginName: string) => boolean;
        getReveals: (pluginName: string) => Set<string>;
        getBadge: (plugin: PluginInfo) => { label: string; variant: "default" | "secondary" };
        fieldKey: (pluginName: string, fieldKey: string) => string;
        setField: (pluginName: string, fieldKey: string, value: string) => void;
        toggleReveal: (pluginName: string, fieldKey: string) => void;
        savePlugin: (pluginName: string) => void;
    } = $props();
</script>

<div class="space-y-4">
    <div>
        <h2 class="text-2xl font-semibold">{title}</h2>
        <p class="text-muted-foreground mt-2 max-w-3xl text-sm">{description}</p>
    </div>

    {#if plugins.length === 0}
        <div class="rounded-2xl border border-dashed p-6">
            <p class="text-muted-foreground text-sm">{emptyMessage}</p>
        </div>
    {:else}
        <div class="space-y-4">
            {#each plugins as plugin (plugin.name)}
                <SetupPluginCard
                    {plugin}
                    fields={getFields(plugin.name)}
                    loading={getLoading(plugin.name)}
                    saving={getSaving(plugin.name)}
                    reveals={getReveals(plugin.name)}
                    badge={getBadge(plugin)}
                    {fieldKey}
                    {setField}
                    {toggleReveal}
                    {savePlugin} />
            {/each}
        </div>
    {/if}
</div>
