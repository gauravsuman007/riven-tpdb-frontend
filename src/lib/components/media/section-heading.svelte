<script lang="ts">
    interface Props {
        title: string;
    }

    let { title }: Props = $props();
</script>

<div class="mb-4 flex items-center gap-3">
    <div class="bg-primary h-6 w-1 rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]"></div>
    <h2 class="text-foreground text-xl font-bold tracking-tight drop-shadow-md">
        {title}
    </h2>
</div>
