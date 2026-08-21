<script lang="ts">
    import { fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";

    interface Props {
        scores:
            | Array<{ name: string; image?: string; score: string; url: string }>
            | null
            | undefined;
        loading: boolean;
    }

    let { scores, loading }: Props = $props();
</script>

{#if scores?.length}
    <div
        class="flex items-center gap-5"
        in:fly|global={{ y: 20, duration: 400, delay: 300, easing: cubicOut }}>
        {#each scores as score (score.name)}
            <a
                href={score.url}
                target="_blank"
                rel="external noopener noreferrer"
                class="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 transition-colors">
                {#if score.image}<img
                        src="/rating-logos/{score.image}"
                        alt={score.name}
                        class="h-6 w-6 object-contain" />{/if}
                <span class="text-base font-semibold">{score.score}</span>
            </a>
        {/each}
    </div>
{:else if loading}
    <div class="flex gap-4">
        {#each [1, 2, 3] as i (i)}
            <div class="bg-muted h-6 w-14 animate-pulse rounded"></div>
        {/each}
    </div>
{/if}
