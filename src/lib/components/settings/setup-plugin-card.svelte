<script lang="ts">
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import type { PluginInfo } from "./types";

    let {
        plugin,
        fields,
        loading,
        saving,
        reveals,
        badge,
        fieldKey,
        setField,
        toggleReveal,
        savePlugin
    }: {
        plugin: PluginInfo;
        fields: Record<string, string>;
        loading: boolean;
        saving: boolean;
        reveals: Set<string>;
        badge: { label: string; variant: "default" | "secondary" };
        fieldKey: (pluginName: string, fieldKey: string) => string;
        setField: (pluginName: string, fieldKey: string, value: string) => void;
        toggleReveal: (pluginName: string, fieldKey: string) => void;
        savePlugin: (pluginName: string) => void;
    } = $props();
</script>

<div class="bg-card rounded-2xl border p-5">
    <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
            <div class="flex items-center gap-2">
                <h3 class="text-lg font-semibold">{plugin.name}</h3>
                <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
            <p class="text-muted-foreground mt-1 text-sm">v{plugin.version}</p>
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
                <div class="rounded-xl border p-4">
                    <div class="mb-2 flex items-center gap-2">
                        <Label for={fieldKey(plugin.name, field.key)}>{field.label}</Label>
                        {#if field.required}
                            <span class="text-destructive text-xs font-medium">Required</span>
                        {/if}
                    </div>

                    {#if field.description}
                        <p class="text-muted-foreground mb-3 text-sm">{field.description}</p>
                    {/if}

                    {#if field.type === "boolean"}
                        <Switch
                            id={fieldKey(plugin.name, field.key)}
                            checked={fields[field.key] === "true"}
                            onCheckedChange={(v) => setField(plugin.name, field.key, String(v))} />
                    {:else if field.type === "textarea"}
                        <textarea
                            id={fieldKey(plugin.name, field.key)}
                            rows="4"
                            class="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[96px] w-full rounded-md border px-3 py-2 text-sm shadow-xs focus-visible:ring-1 focus-visible:outline-none"
                            placeholder={field.placeholder ?? field.default_value ?? ""}
                            oninput={(e) =>
                                setField(
                                    plugin.name,
                                    field.key,
                                    (e.currentTarget as HTMLTextAreaElement).value
                                )}>{fields[field.key] ?? ""}</textarea>
                    {:else}
                        <div class="flex items-center gap-2">
                            <Input
                                id={fieldKey(plugin.name, field.key)}
                                type={field.type === "password" && !reveals.has(field.key)
                                    ? "password"
                                    : field.type === "number"
                                      ? "number"
                                      : field.type === "url"
                                        ? "url"
                                        : "text"}
                                placeholder={field.placeholder ?? field.default_value ?? ""}
                                value={fields[field.key] ?? ""}
                                oninput={(e) =>
                                    setField(
                                        plugin.name,
                                        field.key,
                                        (e.currentTarget as HTMLInputElement).value
                                    )} />
                            {#if field.type === "password"}
                                <Button
                                    type="button"
                                    variant="outline"
                                    onclick={() => toggleReveal(plugin.name, field.key)}>
                                    {reveals.has(field.key) ? "Hide" : "Show"}
                                </Button>
                            {/if}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>
