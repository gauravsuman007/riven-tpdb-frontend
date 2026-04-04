<script lang="ts">
    import { enhance } from "$app/forms";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import * as Select from "$lib/components/ui/select/index.js";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import type { SettingFieldDef } from "./types";

    let {
        general = $bindable(),
        schema
    }: {
        general: Record<string, unknown>;
        schema: SettingFieldDef[];
    } = $props();
</script>

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
        {#each schema as field (field.key)}
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
                        <Switch checked={!!val} onCheckedChange={(v) => (general[field.key] = v)} />
                    </div>
                {:else if field.options?.length}
                    <div class="space-y-2">
                        <Label for="gen-{field.key}">{field.label}</Label>
                        {#if field.description}
                            <p class="text-muted-foreground text-sm">{field.description}</p>
                        {/if}
                        <Select.Root
                            type="single"
                            value={val != null ? String(val) : field.default_value ?? ""}
                            onValueChange={(value) => (general[field.key] = value)}>
                            <Select.Trigger class="max-w-xs">
                                {val != null ? String(val) : field.default_value ?? field.label}
                            </Select.Trigger>
                            <Select.Content>
                                {#each field.options as option}
                                    <Select.Item value={option} label={option} />
                                {/each}
                            </Select.Content>
                        </Select.Root>
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
                                general[field.key] =
                                    field.type === "number"
                                        ? raw === ""
                                            ? null
                                            : Number(raw)
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
