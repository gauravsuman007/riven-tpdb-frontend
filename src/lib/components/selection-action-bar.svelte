<script lang="ts">
    import type { Component } from "svelte";
    import { fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import { Button } from "$lib/components/ui/button/index.js";
    import Loading2Circle from "@lucide/svelte/icons/loader-2";
    import X from "@lucide/svelte/icons/x";
    import { cn } from "$lib/utils";

    export interface SelectionAction {
        label: string;
        icon: Component;
        onClick: () => void;
        variant?: "default" | "destructive";
    }

    let {
        count,
        actions,
        disabled = false,
        onClear
    }: {
        count: number;
        actions: SelectionAction[];
        disabled?: boolean;
        onClear: () => void;
    } = $props();
</script>

{#if count > 0}
    <div
        transition:fly={{ y: 100, duration: 400, easing: cubicOut }}
        class="fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-3xl border border-white/10 bg-zinc-900/80 p-2 pl-4 shadow-2xl backdrop-blur-xl">
        <div class="mr-4 flex items-center gap-3">
            <div
                class="bg-primary/20 text-primary flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold">
                {count}
            </div>
            <span class="text-sm font-medium text-zinc-300">Selected</span>
        </div>

        <div class="mx-1 h-8 w-px bg-white/10"></div>

        <div class="flex items-center gap-1">
            {#each actions as action (action.label)}
                <Button
                    variant="ghost"
                    size="sm"
                    {disabled}
                    onclick={action.onClick}
                    class={cn(
                        "h-9 gap-2 rounded-xl px-3 transition-all",
                        action.variant === "destructive"
                            ? "hover:bg-red-500/20 hover:text-red-400"
                            : "hover:bg-white/10"
                    )}>
                    {#if disabled}
                        <Loading2Circle class="h-3.5 w-3.5 animate-spin" />
                    {:else}
                        <action.icon class="h-3.5 w-3.5" />
                    {/if}
                    {action.label}
                </Button>
            {/each}

            <div class="mx-1 h-8 w-px bg-white/10"></div>

            <Button
                variant="ghost"
                size="icon"
                class="h-9 w-9 rounded-xl hover:bg-white/10"
                onclick={onClear}>
                <X class="h-4 w-4" />
            </Button>
        </div>
    </div>
{/if}
