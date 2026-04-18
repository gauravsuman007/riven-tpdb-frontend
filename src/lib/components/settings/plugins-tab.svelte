<script lang="ts">
    import { enhance } from "$app/forms";
    import { toast } from "svelte-sonner";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import { Separator } from "$lib/components/ui/separator/index.js";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import { pluginStatus } from "./helpers";
    import type { PluginInfo, SettingFieldDef } from "./types";

    let {
        plugins,
        selectedPlugin = $bindable(),
        pluginFields = $bindable(),
        pluginLoading,
        pluginSaving = $bindable(),
        revealedFields = $bindable(),
        selectPlugin,
        onPluginSaved
    }: {
        plugins: PluginInfo[];
        selectedPlugin: PluginInfo | null;
        pluginFields: Record<string, string>;
        pluginLoading: boolean;
        pluginSaving: boolean;
        revealedFields: Set<string>;
        selectPlugin: (plugin: PluginInfo) => void;
        onPluginSaved: (name: string, enabled: boolean, valid: boolean) => void;
    } = $props();

    function fieldOptions(pluginName: string, field: SettingFieldDef): string[] {
        if (field.options?.length) return field.options;
        if (pluginName === "logs" && field.key === "log_level") {
            return ["error", "warn", "info", "debug", "trace"];
        }
        return [];
    }
</script>

{#if plugins.length === 0}
    <p class="text-muted-foreground text-sm">No plugins registered.</p>
{:else}
    <div class="flex gap-6">
        <aside class="w-48 shrink-0 space-y-1">
            {#each plugins as plugin (plugin.name)}
                <button
                    type="button"
                    onclick={() => selectPlugin(plugin)}
                    class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors {selectedPlugin?.name ===
                    plugin.name
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted'}">
                    <span
                        class="h-2 w-2 shrink-0 rounded-full {plugin.enabled
                            ? plugin.valid
                                ? 'bg-green-500'
                                : 'bg-amber-500'
                            : 'bg-zinc-500'}">
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
                    <Badge variant={status.variant}>{status.label}</Badge>
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
                                    const enabled =
                                        (result.data as { enabled?: boolean })?.enabled ?? false;
                                    const valid =
                                        (result.data as { valid?: boolean })?.valid ?? false;
                                    onPluginSaved(name, enabled, valid);
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
                                                onCheckedChange={(v) =>
                                                    (pluginFields[f.key] = String(v))} />
                                        {:else if f.type === "textarea"}
                                            <textarea
                                                id="plg-{f.key}"
                                                rows="3"
                                                placeholder={f.placeholder ?? f.default_value ?? ""}
                                                oninput={(e) =>
                                                    (pluginFields[f.key] = (
                                                        e.currentTarget as HTMLTextAreaElement
                                                    ).value)}
                                                class="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-20 w-full rounded-md border px-3 py-2 text-sm shadow-xs focus-visible:ring-1 focus-visible:outline-none"
                                                >{pluginFields[f.key] ?? ""}</textarea>
                                        {:else if f.options?.length || f.type === "select"}
                                            {@const options = fieldOptions(selectedPlugin.name, f)}
                                            <select
                                                id="plg-{f.key}"
                                                class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 max-w-sm rounded-md border px-3 py-2 text-sm shadow-xs focus-visible:ring-1 focus-visible:outline-none"
                                                value={pluginFields[f.key] ??
                                                    f.default_value ??
                                                    options[0] ??
                                                    ""}
                                                onchange={(e) =>
                                                    (pluginFields[f.key] = (
                                                        e.currentTarget as HTMLSelectElement
                                                    ).value)}>
                                                {#each options as option (option)}
                                                    <option value={option}>{option}</option>
                                                {/each}
                                            </select>
                                        {:else}
                                            <div class="flex items-center gap-2">
                                                <Input
                                                    id="plg-{f.key}"
                                                    type={f.type === "password" &&
                                                    !revealedFields.has(f.key)
                                                        ? "password"
                                                        : f.type === "number"
                                                          ? "number"
                                                          : f.type === "url"
                                                            ? "url"
                                                            : "text"}
                                                    placeholder={f.placeholder ??
                                                        f.default_value ??
                                                        ""}
                                                    value={pluginFields[f.key] ?? ""}
                                                    oninput={(e) =>
                                                        (pluginFields[f.key] = (
                                                            e.currentTarget as HTMLInputElement
                                                        ).value)}
                                                    class="flex-1" />
                                                {#if f.type === "password"}
                                                    <button
                                                        type="button"
                                                        class="text-muted-foreground hover:text-foreground shrink-0"
                                                        aria-label={revealedFields.has(f.key)
                                                            ? "Hide"
                                                            : "Reveal"}
                                                        onclick={() => {
                                                            if (revealedFields.has(f.key)) {
                                                                revealedFields = new Set(
                                                                    [...revealedFields].filter(
                                                                        (k) => k !== f.key
                                                                    )
                                                                );
                                                            } else {
                                                                revealedFields = new Set([
                                                                    ...revealedFields,
                                                                    f.key
                                                                ]);
                                                            }
                                                        }}>
                                                        {revealedFields.has(f.key)
                                                            ? "Hide"
                                                            : "Show"}
                                                    </button>
                                                {/if}
                                            </div>
                                        {/if}
                                        {#if f.description}
                                            <p class="text-muted-foreground text-xs">
                                                {f.description}
                                            </p>
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
