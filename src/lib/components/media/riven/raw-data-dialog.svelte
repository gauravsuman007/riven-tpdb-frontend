<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import FileJson from "@lucide/svelte/icons/file-json";
    import { toast } from "svelte-sonner";

    interface Props {
        open: boolean;
        loading: boolean;
        error: string | undefined;
        json: string | undefined;
    }

    let { open = $bindable(false), loading, error, json }: Props = $props();
</script>

<Dialog.Root bind:open>
    <Dialog.Trigger>
        {#snippet child({ props })}
            <Button
                variant="secondary"
                size="default"
                class="border-border text-muted-foreground hover:bg-muted hover:text-foreground border bg-transparent px-4"
                {...props}>
                <FileJson class="mr-1.5 h-4 w-4" />
                Raw Data
            </Button>
        {/snippet}
    </Dialog.Trigger>
    <Dialog.Content class="border-border bg-background w-full max-w-4xl">
        <Dialog.Header>
            <Dialog.Title>Raw Riven Data</Dialog.Title>
        </Dialog.Header>
        <div class="bg-muted/50 max-h-100 overflow-auto rounded-lg p-4">
            {#if loading && !json}
                <p class="text-muted-foreground text-sm">Loading full Riven data...</p>
            {:else if error}
                <p class="text-destructive text-sm">
                    {error}
                </p>
            {/if}
            {#if json}
                <pre
                    class="font-mono text-xs break-all whitespace-pre-wrap text-green-400">{json}</pre>
            {/if}
        </div>
        <Button
            variant="outline"
            disabled={!json}
            onclick={() => {
                navigator.clipboard.writeText(json ?? "");
                toast.success("Copied!");
            }}>Copy JSON</Button>
    </Dialog.Content>
</Dialog.Root>
