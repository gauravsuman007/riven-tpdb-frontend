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

<div class="space-y-4">
    {#each schema as field (field.key)}
        <SettingFieldEditor {field} bind:value={general[field.key]} />
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
