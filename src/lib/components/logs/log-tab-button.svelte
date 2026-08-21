<script lang="ts">
    let {
        name,
        isActive,
        onclick
    }: {
        name: string;
        isActive: boolean;
        onclick: () => void;
    } = $props();
</script>

<button
    class="rounded px-3 py-1.5 text-sm font-medium transition-colors {isActive
        ? 'bg-primary/10 text-primary'
        : 'hover:bg-muted/50'}"
    {onclick}>
    {name}
</button>
