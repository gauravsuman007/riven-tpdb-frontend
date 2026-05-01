<script lang="ts">
    import { enhance } from "$app/forms";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button/index.js";
    import SettingFieldEditor from "./setting-field-editor.svelte";
    import type { SettingFieldDef } from "./types";

    let {
        general = $bindable(),
        schema
    }: {
        general: Record<string, unknown>;
        schema: SettingFieldDef[];
    } = $props();

    // Group fields by section while preserving original ordering. Fields with
    // no section land in a leading unnamed group. Each named section is
    // emitted on first encounter.
    const groupedSchema = $derived.by(() => {
        const groups: { section: string | null; fields: SettingFieldDef[] }[] = [];
        const indexBySection = new Map<string, number>();
        let defaultGroupIndex: number | null = null;

        for (const field of schema) {
            const section = field.section ?? null;
            if (section === null) {
                if (defaultGroupIndex === null) {
                    defaultGroupIndex = groups.length;
                    groups.push({ section: null, fields: [] });
                }
                groups[defaultGroupIndex].fields.push(field);
            } else {
                let idx = indexBySection.get(section);
                if (idx === undefined) {
                    idx = groups.length;
                    indexBySection.set(section, idx);
                    groups.push({ section, fields: [] });
                }
                groups[idx].fields.push(field);
            }
        }
        return groups;
    });

    function generalSaveMessage(resultData: unknown): string {
        if (
            resultData &&
            typeof resultData === "object" &&
            "updatedCount" in resultData &&
            typeof resultData.updatedCount === "number"
        ) {
            const updatedCount = resultData.updatedCount;
            if (updatedCount > 0) {
                return `General settings saved. Rebuilt library profile matches for ${updatedCount} entries`;
            }
            return "General settings saved. Library profile matches already up to date";
        }

        return "General settings saved";
    }
</script>

<div class="space-y-8">
    {#each groupedSchema as group, i (group.section ?? `__default-${i}`)}
        <section class="space-y-4">
            {#if group.section}
                <h2 class="text-lg font-semibold tracking-tight">{group.section}</h2>
            {/if}
            {#each group.fields as field (field.key)}
                <SettingFieldEditor {field} bind:value={general[field.key]} />
            {/each}
        </section>
    {/each}

    <div class="flex flex-wrap gap-3">
        <form
            method="POST"
            action="?/updateGeneral"
            use:enhance={() =>
                async ({ result }) => {
                    if (result.type === "success") {
                        toast.success(generalSaveMessage(result.data));
                    } else toast.error("Failed to save general settings");
                }}>
            <input type="hidden" name="settings" value={JSON.stringify(general)} />
            <Button type="submit">Save general settings</Button>
        </form>
    </div>
</div>
