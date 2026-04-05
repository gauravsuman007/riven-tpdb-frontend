<script lang="ts">
    import * as Card from "$lib/components/ui/card/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";

    let {
        statuses
    }: {
        statuses: Record<string, boolean | null> | null;
    } = $props();

    const entries = $derived(statuses ? Object.entries(statuses) : []);

    function badgeVariant(status: boolean | null) {
        if (status === true) return "default";
        if (status === false) return "destructive";
        return "secondary";
    }

    function badgeClass(status: boolean | null) {
        if (status === true) {
            return "rounded-xl bg-green-600/20 px-2 py-1 text-xs font-medium text-green-400";
        }
        return "rounded-xl px-2 py-1 text-xs font-medium";
    }
</script>

<section class="mb-8 grid grid-cols-1">
    <Card.Root>
        <Card.Header>
            <Card.Title class="text-sm font-medium text-neutral-300">Service Status</Card.Title>
        </Card.Header>
        <Card.Content>
            <div class="flex flex-wrap gap-4">
                {#if entries.length > 0}
                    {#each entries as [serviceName, status] (serviceName)}
                        <Badge variant={badgeVariant(status)} class={badgeClass(status)}>
                            {serviceName}
                        </Badge>
                    {/each}
                {:else}
                    <p class="text-sm text-neutral-400">No service data available.</p>
                {/if}
            </div>
        </Card.Content>
    </Card.Root>
</section>
