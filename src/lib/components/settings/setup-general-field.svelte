<script lang="ts">
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import type { SettingFieldDef } from "./types";

    let {
        field,
        general = $bindable()
    }: {
        field: SettingFieldDef;
        general: Record<string, unknown>;
    } = $props();

    const value = $derived(general[field.key]);
</script>

<div class="rounded-xl border p-4">
    {#if field.type === "boolean"}
        <div class="flex items-center justify-between gap-4">
            <div>
                <Label class="text-base">{field.label}</Label>
                {#if field.description}
                    <p class="text-muted-foreground mt-1 text-sm">{field.description}</p>
                {/if}
            </div>
            <Switch checked={!!value} onCheckedChange={(v) => (general[field.key] = v)} />
        </div>
    {:else}
        <div class="space-y-2">
            <Label for="setup-general-{field.key}">{field.label}</Label>
            {#if field.description}
                <p class="text-muted-foreground text-sm">{field.description}</p>
            {/if}
            <Input
                id="setup-general-{field.key}"
                type={field.type === "number" ? "number" : "text"}
                min={field.type === "number" ? "0" : undefined}
                placeholder={field.placeholder ?? field.default_value ?? ""}
                value={value != null ? String(value) : ""}
                oninput={(e) => {
                    const raw = (e.currentTarget as HTMLInputElement).value;
                    general[field.key] =
                        field.type === "number" ? (raw === "" ? null : Number(raw)) : raw;
                }}
                class="max-w-sm" />
        </div>
    {/if}
</div>
