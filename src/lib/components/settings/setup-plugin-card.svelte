<script lang="ts">
    import { Button } from "$lib/components/ui/button/index.js";
    import SetupPluginField from "./setup-plugin-field.svelte";
    import type { PluginInfo } from "./types";

    let {
        plugin,
        fields,
        loading,
        saving,
        reveals,
        setField,
        toggleReveal,
        savePlugin
    }: {
        plugin: PluginInfo;
        fields: Record<string, string>;
        loading: boolean;
        saving: boolean;
        reveals: Set<string>;
        setField: (pluginName: string, fieldKey: string, value: string) => void;
        toggleReveal: (pluginName: string, fieldKey: string) => void;
        savePlugin: (pluginName: string) => void;
    } = $props();
</script>

<div class="bg-background/55 rounded-[2rem] border p-6 shadow-lg">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
            <h3 class="text-xl font-semibold">{plugin.name}</h3>
            <p class="text-muted-foreground mt-2 text-sm">v{plugin.version}</p>
        </div>
        <Button
            type="button"
            variant="outline"
            disabled={saving}
            onclick={() => savePlugin(plugin.name)}>
            {saving ? "Saving…" : "Save plugin"}
        </Button>
    </div>

    {#if loading}
        <p class="text-muted-foreground text-sm">Loading settings…</p>
    {:else if plugin.schema.length === 0}
        <p class="text-muted-foreground text-sm">This plugin has no configurable fields.</p>
    {:else}
        <div class="grid gap-4 lg:grid-cols-2">
            {#each plugin.schema as field (field.key)}
                <SetupPluginField
                    pluginName={plugin.name}
                    {field}
                    value={fields[field.key] ?? ""}
                    revealed={reveals.has(field.key)}
                    {setField}
                    {toggleReveal} />
            {/each}
        </div>
    {/if}
</div>
