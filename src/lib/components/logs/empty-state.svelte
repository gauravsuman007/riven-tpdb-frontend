<script lang="ts">
    let {
        message,
        actionText,
        actionFn
    }: {
        message: string;
        actionText?: string;
        actionFn?: () => void;
    } = $props();
</script>

<div class="flex h-full flex-col items-center justify-center p-8">
    <p class="text-muted-foreground text-sm">{message}</p>
    {#if actionText && actionFn}
        <button
            class="bg-primary/10 hover:bg-primary/20 text-primary mt-4 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            onclick={actionFn}>
            {actionText}
        </button>
    {/if}
</div>
