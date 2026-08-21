<script lang="ts">
    import { Button } from "$lib/components/ui/button/index.js";
    import Star from "@lucide/svelte/icons/star";

    let {
        providerKey,
        provider,
        isLastUsed,
        onclick
    }: {
        providerKey: string;
        provider: { name?: string; icon?: string };
        isLastUsed: boolean;
        onclick: () => void;
    } = $props();
</script>

<Button
    {onclick}
    variant={isLastUsed ? "secondary" : "outline"}
    class="relative w-full"
    type="button">
    {#if providerKey === "plex"}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="mr-2 h-4 w-4">
            <path d="M256 70H148l108 186-108 186h108l108-186z" fill="currentColor" />
        </svg>
    {:else if provider.icon}
        <img src={provider.icon} alt="{provider.name} icon" class="mr-2 h-4 w-4" />
    {:else}
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="mr-2 h-4 w-4"
            ><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path
                d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line
                x1="17.5"
                x2="17.51"
                y1="6.5"
                y2="6.5" /></svg>
    {/if}
    Login with {provider.name || providerKey.charAt(0).toUpperCase() + providerKey.slice(1)}
    {#if isLastUsed}
        <Star class="absolute top-0 -right-2 h-4 w-4 rotate-45 animate-pulse text-yellow-400" />
    {/if}
</Button>
