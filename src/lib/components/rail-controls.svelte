<!--
    A rail's rating filter and sort.

    Both re-ask the catalogue rather than filtering the twenty titles already
    on screen; see `getRail`. The distinction matters: "the four titles in this
    row that have four stars" and "the catalogue's best four-star titles for
    this intent" are different answers, and only the second is the one anyone
    means.
-->
<script lang="ts">
    import type { RailSort } from "$lib/recommendations";
    import StarIcon from "@lucide/svelte/icons/star";
    import ArrowDownWideNarrowIcon from "@lucide/svelte/icons/arrow-down-wide-narrow";
    import SparklesIcon from "@lucide/svelte/icons/sparkles";
    import { cn } from "$lib/utils";

    interface Props {
        minRating: number;
        sort: RailSort;
        busy?: boolean;
        onChange: (next: { minRating: number; sort: RailSort }) => void;
    }

    let { minRating, sort, busy = false, onChange }: Props = $props();

    // Halves below four, because that is where the catalogue's ratings
    // actually sit -- Adult Empire's audience scores cluster between 3 and 5,
    // so whole-star steps would offer one useful setting.
    const steps = [
        { value: 0, label: "Any" },
        { value: 3, label: "3+" },
        { value: 3.5, label: "3.5+" },
        { value: 4, label: "4+" },
        { value: 4.5, label: "4.5+" }
    ];
</script>

<div class="flex shrink-0 items-center gap-3" class:opacity-60={busy}>
    <div
        class="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 p-0.5"
        role="group"
        aria-label="Minimum rating">
        <StarIcon class="ml-1.5 size-3 fill-amber-400 text-amber-400" aria-hidden="true" />
        {#each steps as step (step.value)}
            <button
                type="button"
                disabled={busy}
                onclick={() => onChange({ minRating: step.value, sort })}
                class={cn(
                    "rounded-md px-2 py-1 font-mono text-[11px] transition-colors",
                    minRating === step.value
                        ? "bg-white/90 font-semibold text-black"
                        : "text-zinc-300 hover:bg-white/10"
                )}
                aria-pressed={minRating === step.value}>
                {step.label}
            </button>
        {/each}
    </div>

    <div
        class="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 p-0.5"
        role="group"
        aria-label="Sort">
        <button
            type="button"
            disabled={busy}
            onclick={() => onChange({ minRating, sort: "score" })}
            title="Rank by the engine's own score: awards, demand, and what your library contains"
            class={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] transition-colors",
                sort === "score"
                    ? "bg-white/90 font-semibold text-black"
                    : "text-zinc-300 hover:bg-white/10"
            )}
            aria-pressed={sort === "score"}>
            <SparklesIcon class="size-3" aria-hidden="true" />
            Best match
        </button>
        <button
            type="button"
            disabled={busy}
            onclick={() => onChange({ minRating, sort: "rating" })}
            title="Order by audience rating, highest first. Unrated titles sort last rather than being hidden."
            class={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] transition-colors",
                sort === "rating"
                    ? "bg-white/90 font-semibold text-black"
                    : "text-zinc-300 hover:bg-white/10"
            )}
            aria-pressed={sort === "rating"}>
            <ArrowDownWideNarrowIcon class="size-3" aria-hidden="true" />
            Rating
        </button>
    </div>
</div>
