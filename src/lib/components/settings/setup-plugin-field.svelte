<script lang="ts">
    import Eye from "@lucide/svelte/icons/eye";
    import EyeOff from "@lucide/svelte/icons/eye-off";
    import * as ButtonGroup from "$lib/components/ui/button-group/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import { settingsSwitchClass } from "./helpers";
    import type { SettingFieldDef } from "./types";

    let {
        pluginName,
        field,
        value,
        revealed,
        setField,
        toggleReveal
    }: {
        pluginName: string;
        field: SettingFieldDef;
        value: string;
        revealed: boolean;
        setField: (pluginName: string, fieldKey: string, value: string) => void;
        toggleReveal: (pluginName: string, fieldKey: string) => void;
    } = $props();

    const inputId = $derived(`${pluginName}:${field.key}`);
    const inputType = $derived(
        field.type === "password" && !revealed
            ? "password"
            : field.type === "number"
              ? "number"
              : field.type === "url"
                ? "url"
                : "text"
    );

    const options = $derived(field.options ?? []);
</script>

<div class="rounded-xl border p-4">
    <div class="mb-2 flex items-center gap-2">
        <Label for={inputId}>{field.label}</Label>
        {#if field.required}
            <span class="text-destructive text-xs font-medium">Required</span>
        {/if}
    </div>

    {#if field.description}
        <p class="text-muted-foreground mb-3 text-sm">{field.description}</p>
    {/if}

    {#if field.type === "boolean"}
        <Switch
            id={inputId}
            class={settingsSwitchClass}
            checked={value === "true"}
            onCheckedChange={(next) => setField(pluginName, field.key, String(next))} />
    {:else if field.type === "textarea"}
        <textarea
            id={inputId}
            rows="4"
            class="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-24 w-full rounded-md border px-3 py-2 text-sm shadow-xs focus-visible:ring-1 focus-visible:outline-none"
            placeholder={field.placeholder ?? field.default_value ?? ""}
            oninput={(event) =>
                setField(pluginName, field.key, (event.currentTarget as HTMLTextAreaElement).value)}
            >{value}</textarea>
    {:else if field.options?.length || field.type === "select"}
        <select
            id={inputId}
            class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm shadow-xs focus-visible:ring-1 focus-visible:outline-none"
            value={value || field.default_value || options[0] || ""}
            onchange={(event) =>
                setField(pluginName, field.key, (event.currentTarget as HTMLSelectElement).value)}>
            {#each options as option (option)}
                <option value={option}>{option}</option>
            {/each}
        </select>
    {:else}
        <div class="flex items-center gap-2">
            <Input
                id={inputId}
                type={inputType}
                placeholder={field.placeholder ?? field.default_value ?? ""}
                {value}
                oninput={(event) =>
                    setField(
                        pluginName,
                        field.key,
                        (event.currentTarget as HTMLInputElement).value
                    )} />
            {#if field.type === "password"}
                <ButtonGroup.Root class="shrink-0">
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={revealed ? "Hide password" : "Show password"}
                        onclick={() => toggleReveal(pluginName, field.key)}>
                        {#if revealed}
                            <EyeOff />
                        {:else}
                            <Eye />
                        {/if}
                    </Button>
                </ButtonGroup.Root>
            {/if}
        </div>
    {/if}
</div>
