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
            <SettingFieldEditor {field} bind:value={general[field.key]} />
        {/each}

        <Button type="submit">Save general settings</Button>
    </div>
</form>
