<script lang="ts">
    let {
        errorMessage,
        retryAction,
        buttonText = "Try Again"
    }: {
        errorMessage: string;
        retryAction: () => void;
        buttonText?: string;
    } = $props();
</script>

<div class="bg-destructive/10 border-destructive/20 rounded-lg border p-6">
    <h3 class="text-destructive mb-3 text-lg font-semibold">Error Loading Logs</h3>
    <pre
        class="text-destructive/80 bg-destructive/5 mb-4 overflow-x-auto rounded border p-3 font-mono text-sm">{errorMessage}</pre>
    <button
        class="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 font-medium transition-colors"
        onclick={retryAction}>
        {buttonText}
    </button>
</div>
