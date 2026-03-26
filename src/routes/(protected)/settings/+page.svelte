<script lang="ts">
    import { enhance } from "$app/forms";
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
    import type { PluginInfo, SettingFieldDef } from "./+page.server";

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

    function updatePluginValid(name: string, valid: boolean) {
        const entry = plugins.find((p) => p.name === name);
        if (entry) entry.valid = valid;
        if (selectedPlugin?.name === name) selectedPlugin.valid = valid;
    }

    async function loadPluginSettings(plugin: PluginInfo) {
        selectedPlugin = plugin;
        pluginFields = {};
        pluginLoading = true;
        try {
            const fd = new FormData();
            fd.set("plugin", plugin.name);
            const res = await fetch("?/loadPluginSettings", { method: "POST", body: fd });
            const json = await res.json();
            const payload = json?.data ?? json;
            if (payload?.pluginSettings) pluginFields = payload.pluginSettings;
        } catch {
            toast.error("Failed to load plugin settings");
        } finally {
            pluginLoading = false;
        }
    }

    $effect(() => {
        if (selectedPlugin) loadPluginSettings(selectedPlugin);
    });

    // ── Ranking ───────────────────────────────────────────────────────────────
    // The full rank settings object — we keep it as-is from the server and mutate it.
    let rank = $state<Record<string, unknown>>(
        JSON.parse(JSON.stringify(data.rankSettings ?? {}))
    );

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
        | "custom_rank_object"    // Record<string, {fetch,use_custom_rank,rank}>
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
                entries.every(
                    ([, val]) =>
                        val !== null &&
                        typeof val === "object" &&
                        "fetch" in (val as object) &&
                        "use_custom_rank" in (val as object) &&
                        "rank" in (val as object)
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
                                    onclick={() => loadPluginSettings(plugin)}
                                    class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors {selectedPlugin?.name === plugin.name ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}">
                                    <span
                                        class="h-2 w-2 shrink-0 rounded-full {plugin.valid ? 'bg-green-500' : 'bg-zinc-500'}">
                                    </span>
                                    {plugin.name}
                                </button>
                            {/each}
                        </aside>

                        <Separator orientation="vertical" class="h-auto" />

                        <div class="min-w-0 flex-1">
                            {#if selectedPlugin}
                                <div class="mb-4 flex items-center gap-3">
                                    <h2 class="text-lg font-medium">{selectedPlugin.name}</h2>
                                    <Badge variant={selectedPlugin.valid ? "default" : "secondary"}>
                                        {selectedPlugin.valid ? "Active" : "Inactive"}
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
                                                    const valid = (result.data as { valid?: boolean })?.valid ?? false;
                                                    updatePluginValid(name, valid);
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
                                                            <Input
                                                                id="plg-{f.key}"
                                                                type={f.type === "password" ? "password" : f.type === "number" ? "number" : f.type === "url" ? "url" : "text"}
                                                                placeholder={f.placeholder ?? f.default_value ?? ""}
                                                                value={pluginFields[f.key] ?? ""}
                                                                oninput={(e) => (pluginFields[f.key] = (e.currentTarget as HTMLInputElement).value)} />
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
                            if (result.type === "success") toast.success("Ranking settings saved");
                            else toast.error("Failed to save ranking settings");
                        }}>
                    <input type="hidden" name="settings" value={JSON.stringify(rank)} />

                    <div class="space-y-8">
                        {#each Object.entries(rank) as [key, value]}
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
                                <details class="rounded-lg border">
                                    <summary class="cursor-pointer select-none px-4 py-3 text-sm font-medium">
                                        {toLabel(key)}
                                    </summary>
                                    <div class="divide-y px-4 pb-2">
                                        {#each Object.entries(value as Record<string, { fetch: boolean; use_custom_rank: boolean; rank: number }>) as [attr, cr]}
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
                                                    value={cr.use_custom_rank ? cr.rank : ""}
                                                    placeholder="default"
                                                    oninput={(e) => {
                                                        const raw = (e.currentTarget as HTMLInputElement).value;
                                                        if (raw === "") {
                                                            cr.use_custom_rank = false;
                                                            cr.rank = 0;
                                                        } else {
                                                            cr.use_custom_rank = true;
                                                            cr.rank = Number(raw);
                                                        }
                                                    }}
                                                    class="h-7 w-24 text-sm" />
                                            </div>
                                        {/each}
                                    </div>
                                </details>

                            {:else if shape === "settings_section"}
                                <!-- Generic nested section: booleans → switches, numbers → inputs, arrays → tag inputs -->
                                <section class="space-y-3">
                                    <h2 class="text-base font-semibold">{toLabel(key)}</h2>
                                    <div class="space-y-3">
                                        {#each Object.entries(value as Record<string, unknown>) as [subkey, subval]}
                                            {@const subshape = detectShape(subval)}
                                            {#if subshape === "boolean"}
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
