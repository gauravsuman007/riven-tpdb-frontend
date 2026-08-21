<script lang="ts">
    import { Checkbox } from "$lib/components/ui/checkbox/index.js";
    import { cn } from "$lib/utils";
    import { typeStyles } from "./helpers";
    import type { FilterOption } from "./types";

    let {
        options,
        filters = $bindable()
    }: {
        options: FilterOption[];
        filters: Record<string, boolean>;
    } = $props();
</script>

<section class="flex flex-wrap items-center gap-2">
    {#each options as opt (opt.id)}
        {@const Icon = opt.icon}
        {@const selected = filters[opt.type] !== false}
        {@const style = typeStyles[opt.type] ?? typeStyles.movie}
        <label
            for={opt.id}
            class={cn(
                "border-border bg-card/50 hover:bg-accent/50 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                selected && "border-primary/40 bg-primary/10 text-foreground",
                !selected && "text-muted-foreground"
            )}>
            <Checkbox
                id={opt.id}
                checked={filters[opt.type]}
                class="size-4"
                onCheckedChange={(checked: boolean) => (filters[opt.type] = !!checked)} />
            <Icon class={cn("h-4 w-4", style.icon)} />
            <span>{opt.label}</span>
        </label>
    {/each}
</section>
