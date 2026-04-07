<script lang="ts">
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import * as Select from "$lib/components/ui/select/index.js";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import SettingFieldEditor from "./setting-field-editor.svelte";
    import type { SettingFieldDef } from "./types";

    let {
        field,
        value = $bindable(),
        path = field.key,
        nested = false
    }: {
        field: SettingFieldDef;
        value: unknown;
        path?: string;
        nested?: boolean;
    } = $props();

    let arrayDraft = $state("");

    function isRecord(input: unknown): input is Record<string, unknown> {
        return input !== null && typeof input === "object" && !Array.isArray(input);
    }

    function idFor(pathValue: string): string {
        return `setting-${pathValue.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    }

    function parseDefaultValue(fieldDef: SettingFieldDef): unknown {
        if (fieldDef.default_value == null) {
            if (fieldDef.type === "string_array") return [];
            if (fieldDef.type === "object") return createDefaultObject(fieldDef.fields ?? []);
            if (fieldDef.type === "dictionary") return {};
            if (fieldDef.type === "nullable_boolean") return null;
            return undefined;
        }

        if (fieldDef.type === "boolean" || fieldDef.type === "nullable_boolean") {
            return fieldDef.default_value === "true";
        }

        if (fieldDef.type === "number") {
            const parsed = Number(fieldDef.default_value);
            return Number.isNaN(parsed) ? null : parsed;
        }

        return fieldDef.default_value;
    }

    function createDefaultObject(fields: SettingFieldDef[]): Record<string, unknown> {
        const entries = fields
            .map((subfield) => [subfield.key, parseDefaultValue(subfield)] as const)
            .filter(([, fieldValue]) => fieldValue !== undefined);

        return Object.fromEntries(entries);
    }

    function ensureObject(fields: SettingFieldDef[] = []): Record<string, unknown> {
        if (!isRecord(value)) {
            value = createDefaultObject(fields);
        }

        return value as Record<string, unknown>;
    }

    function ensureDictionary(): Record<string, unknown> {
        if (!isRecord(value)) {
            value = {};
        }

        return value as Record<string, unknown>;
    }

    function ensureStringArray(): string[] {
        if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
            value = [];
        }

        return value as string[];
    }

    function ensureDictionaryEntry(
        dictionary: Record<string, unknown>,
        entryKey: string,
        fields: SettingFieldDef[]
    ): Record<string, unknown> {
        const entry = dictionary[entryKey];
        if (!isRecord(entry)) {
            dictionary[entryKey] = createDefaultObject(fields);
            value = { ...dictionary };
        }

        return dictionary[entryKey] as Record<string, unknown>;
    }

    function addArrayValue() {
        const nextValue = arrayDraft.trim();
        if (!nextValue) return;

        const items = ensureStringArray();
        if (!items.includes(nextValue)) {
            items.push(nextValue);
            value = [...items];
        }

        arrayDraft = "";
    }

    function removeArrayValue(index: number) {
        const items = ensureStringArray();
        items.splice(index, 1);
        value = [...items];
    }

    function toggleOption(option: string) {
        const items = ensureStringArray();
        if (items.includes(option)) {
            value = items.filter((item) => item !== option);
            return;
        }

        value = [...items, option];
    }

    function addDictionaryEntry() {
        const dictionary = ensureDictionary();
        const baseKey = field.key_placeholder ?? "entry";
        let index = Object.keys(dictionary).length + 1;
        let entryKey = `${baseKey}_${index}`;

        while (entryKey in dictionary) {
            index += 1;
            entryKey = `${baseKey}_${index}`;
        }

        dictionary[entryKey] = createDefaultObject(field.item_fields ?? []);
        value = { ...dictionary };
    }

    function removeDictionaryEntry(entryKey: string) {
        const dictionary = ensureDictionary();
        delete dictionary[entryKey];
        value = { ...dictionary };
    }

    function renameDictionaryEntry(previousKey: string, nextKeyRaw: string) {
        const nextKey = nextKeyRaw.trim();
        if (!nextKey || nextKey === previousKey) return;

        const dictionary = ensureDictionary();
        if (nextKey in dictionary) return;

        const entries = Object.entries(dictionary).map(([currentKey, currentValue]) =>
            currentKey === previousKey ? [nextKey, currentValue] : [currentKey, currentValue]
        );
        value = Object.fromEntries(entries);
    }
</script>

<div class:rounded-lg={!nested} class:border={!nested} class:p-4={!nested} class="space-y-3">
    {#if field.type === "object"}
        {@const objectValue = ensureObject(field.fields ?? [])}
        <div class="space-y-1">
            <Label class="text-base">{field.label}</Label>
            {#if field.description}
                <p class="text-muted-foreground text-sm">{field.description}</p>
            {/if}
        </div>

        <div class="space-y-3 rounded-lg border p-3">
            {#each field.fields ?? [] as subfield (subfield.key)}
                <SettingFieldEditor
                    field={subfield}
                    bind:value={objectValue[subfield.key]}
                    path={`${path}.${subfield.key}`}
                    nested={true} />
            {/each}
        </div>
    {:else if field.type === "dictionary"}
        {@const dictionaryValue = ensureDictionary()}
        <div class="space-y-1">
            <Label class="text-base">{field.label}</Label>
            {#if field.description}
                <p class="text-muted-foreground text-sm">{field.description}</p>
            {/if}
        </div>

        <div class="space-y-3">
            {#each Object.entries(dictionaryValue) as [entryKey] (entryKey)}
                {@const entryValue = ensureDictionaryEntry(
                    dictionaryValue,
                    entryKey,
                    field.item_fields ?? []
                )}
                <div class="space-y-3 rounded-lg border p-3">
                    <div class="flex items-end gap-3">
                        <div class="min-w-0 flex-1 space-y-2">
                            <Label for={idFor(`${path}.${entryKey}.__key`)}>Profile key</Label>
                            <Input
                                id={idFor(`${path}.${entryKey}.__key`)}
                                value={entryKey}
                                placeholder={field.key_placeholder ?? "entry_key"}
                                onchange={(event) =>
                                    renameDictionaryEntry(
                                        entryKey,
                                        (event.currentTarget as HTMLInputElement).value
                                    )} />
                        </div>
                        <button
                            type="button"
                            class="text-destructive text-sm"
                            onclick={() => removeDictionaryEntry(entryKey)}>
                            Remove
                        </button>
                    </div>

                    <div class="space-y-3">
                        {#each field.item_fields ?? [] as itemField (itemField.key)}
                            <SettingFieldEditor
                                field={itemField}
                                bind:value={entryValue[itemField.key]}
                                path={`${path}.${entryKey}.${itemField.key}`}
                                nested={true} />
                        {/each}
                    </div>
                </div>
            {/each}

            <button
                type="button"
                class="rounded-md border px-3 py-2 text-sm"
                onclick={addDictionaryEntry}>
                {field.add_label ?? "Add entry"}
            </button>
        </div>
    {:else if field.type === "string_array"}
        {@const items = ensureStringArray()}
        <div class="space-y-2">
            <Label for={idFor(path)}>{field.label}</Label>
            {#if field.description}
                <p class="text-muted-foreground text-sm">{field.description}</p>
            {/if}

            {#if field.options?.length}
                <div class="flex flex-wrap gap-2">
                    {#each field.options as option}
                        <button
                            type="button"
                            class={`rounded-full border px-3 py-1 text-xs ${items.includes(option) ? "bg-accent text-accent-foreground" : ""}`}
                            onclick={() => toggleOption(option)}>
                            {option}
                        </button>
                    {/each}
                </div>
            {/if}

            {#if items.length > 0}
                <div class="flex flex-wrap gap-2">
                    {#each items as item, index (`${item}-${index}`)}
                        <span
                            class="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
                            {item}
                            <button
                                type="button"
                                class="leading-none"
                                onclick={() => removeArrayValue(index)}>
                                ×
                            </button>
                        </span>
                    {/each}
                </div>
            {/if}

            <div class="flex max-w-xl gap-2">
                <Input
                    id={idFor(path)}
                    bind:value={arrayDraft}
                    placeholder={field.placeholder ?? "Add value"}
                    onkeydown={(event) => {
                        if (event.key === "Enter" || event.key === ",") {
                            event.preventDefault();
                            addArrayValue();
                        }
                    }} />
                <button
                    type="button"
                    class="rounded-md border px-3 py-2 text-sm"
                    onclick={addArrayValue}>
                    Add
                </button>
            </div>
        </div>
    {:else if field.type === "boolean"}
        <div class="flex items-center justify-between gap-4">
            <div class="space-y-0.5">
                <Label class="text-base">{field.label}</Label>
                {#if field.description}
                    <p class="text-muted-foreground text-sm">{field.description}</p>
                {/if}
            </div>
            <Switch checked={!!value} onCheckedChange={(next) => (value = next)} />
        </div>
    {:else if field.type === "nullable_boolean"}
        <div class="space-y-2">
            <Label for={idFor(path)}>{field.label}</Label>
            {#if field.description}
                <p class="text-muted-foreground text-sm">{field.description}</p>
            {/if}
            <Select.Root
                type="single"
                value={value == null ? "any" : value === true ? "true" : "false"}
                onValueChange={(next) => {
                    value = next === "any" ? null : next === "true";
                }}>
                <Select.Trigger class="max-w-xs">
                    {value == null ? "Any" : value === true ? "Anime only" : "Non-anime only"}
                </Select.Trigger>
                <Select.Content>
                    <Select.Item value="any" label="Any" />
                    <Select.Item value="true" label="Anime only" />
                    <Select.Item value="false" label="Non-anime only" />
                </Select.Content>
            </Select.Root>
        </div>
    {:else if field.options?.length}
        <div class="space-y-2">
            <Label for={idFor(path)}>{field.label}</Label>
            {#if field.description}
                <p class="text-muted-foreground text-sm">{field.description}</p>
            {/if}
            <Select.Root
                type="single"
                value={value != null ? String(value) : (field.default_value ?? "")}
                onValueChange={(next) => (value = next)}>
                <Select.Trigger class="max-w-xs">
                    {value != null ? String(value) : (field.default_value ?? field.label)}
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
            <Label for={idFor(path)}>{field.label}</Label>
            {#if field.description}
                <p class="text-muted-foreground text-sm">{field.description}</p>
            {/if}
            <Input
                id={idFor(path)}
                type={field.type === "number" ? "number" : "text"}
                min={field.type === "number" ? "0" : undefined}
                placeholder={field.placeholder ?? field.default_value ?? ""}
                value={value != null ? String(value) : ""}
                oninput={(event) => {
                    const raw = (event.currentTarget as HTMLInputElement).value;
                    value = field.type === "number" ? (raw === "" ? null : Number(raw)) : raw;
                }}
                class="max-w-xl" />
        </div>
    {/if}
</div>
