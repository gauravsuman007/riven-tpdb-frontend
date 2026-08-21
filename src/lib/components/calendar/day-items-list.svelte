<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog/index.js";
    import EntertainmentItem from "./entertainment-item.svelte";
    import { formatDayTitle } from "./helpers";
    import type { CalendarDay } from "./types";

    let {
        day,
        limit = Infinity,
        showMore = false
    }: {
        day: CalendarDay;
        limit?: number;
        showMore?: boolean;
    } = $props();
</script>

<div class="space-y-1.5">
    {#each day.items.slice(0, limit) as item (item.item_id)}
        <EntertainmentItem {item} compact={limit !== Infinity} />
    {/each}

    {#if showMore && day.items.length > limit}
        <Dialog.Root>
            <Dialog.Trigger>
                {#snippet child({ props })}
                    <button
                        {...props}
                        class="text-muted-foreground hover:text-foreground w-full rounded-md px-2 py-1 text-left text-xs font-medium transition-colors hover:bg-white/5">
                        +{day.items.length - limit} more
                    </button>
                {/snippet}
            </Dialog.Trigger>
            <Dialog.Content class="max-w-md">
                <Dialog.Header>
                    <Dialog.Title class="text-lg font-bold">
                        {formatDayTitle(day.date)}
                    </Dialog.Title>
                    <Dialog.Description>
                        {day.items.length} item{day.items.length !== 1 ? "s" : ""}
                    </Dialog.Description>
                </Dialog.Header>
                <div class="mt-4 max-h-96 space-y-2 overflow-y-auto">
                    {#each day.items as item (item.item_id)}
                        <EntertainmentItem {item} />
                    {/each}
                </div>
            </Dialog.Content>
        </Dialog.Root>
    {/if}
</div>
