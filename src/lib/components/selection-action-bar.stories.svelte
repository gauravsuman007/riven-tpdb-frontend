<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import SelectionActionBar from "./selection-action-bar.svelte";

    const { Story } = defineMeta({
        title: "components/SelectionActionBar",
        component: SelectionActionBar,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen"
        }
    });
</script>

<script lang="ts">
    import ListChecks from "@lucide/svelte/icons/list-checks";
    import Loading2Circle from "@lucide/svelte/icons/loader-2";
    import Trash from "@lucide/svelte/icons/trash";
    import { fn } from "storybook/test";
    import type { SelectionAction } from "./selection-action-bar.svelte";

    const actions: SelectionAction[] = [
        { label: "Reset", icon: ListChecks, onClick: fn() },
        { label: "Retry", icon: Loading2Circle, onClick: fn() },
        { label: "Remove", icon: Trash, variant: "destructive", onClick: fn() }
    ];
</script>

<Story name="Default" asChild>
    <div class="relative h-40 w-full">
        <SelectionActionBar count={5} {actions} onClear={fn()} />
    </div>
</Story>

<Story name="Loading" asChild>
    <div class="relative h-40 w-full">
        <SelectionActionBar count={5} {actions} disabled onClear={fn()} />
    </div>
</Story>

<Story name="Hidden" asChild>
    <div class="relative h-40 w-full">
        <SelectionActionBar count={0} {actions} onClear={fn()} />
    </div>
</Story>
