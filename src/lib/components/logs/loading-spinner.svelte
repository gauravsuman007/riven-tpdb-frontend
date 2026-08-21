<script lang="ts">
    let { message }: { message: string } = $props();
</script>

<div class="flex h-full flex-col items-center justify-center p-8">
    <div
        class="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent">
    </div>
    <p class="text-muted-foreground text-sm">{message}</p>
</div>
