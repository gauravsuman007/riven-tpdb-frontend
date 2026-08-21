<script lang="ts">
    import { cn } from "$lib/utils";

    let {
        title,
        value,
        tone = "default"
    }: {
        title: string;
        value: string | undefined;
        tone?: "default" | "warning";
    } = $props();
</script>

<div class={cn("border-border/60 border-b py-5", tone === "warning" && "border-amber-600/30")}>
    <p class="text-sm font-medium text-neutral-300">{title}</p>
    <div
        class={cn(
            "mt-3 text-2xl font-semibold tracking-tight",
            tone === "warning" ? "text-amber-300" : "text-neutral-50"
        )}>
        {value}
    </div>
</div>
