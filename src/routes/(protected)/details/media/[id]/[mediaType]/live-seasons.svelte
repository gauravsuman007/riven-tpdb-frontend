<script lang="ts">
    import * as Carousel from "$lib/components/ui/carousel/index.js";
    import PortraitCard from "$lib/components/media/portrait-card.svelte";
    import StatusBadge from "$lib/components/media/status-badge.svelte";
    import { cn } from "$lib/utils";
    import type { ParsedShowDetails } from "$lib/metadata/parser";
    import type { RivenSeason } from "$lib/types/riven";

    interface Props {
        seasons: ParsedShowDetails["seasons"];
        selectedSeason?: string;
        stateBySeasonNumber: Map<number, RivenSeason>;
        expectedBySeasonNumber?: Map<number, number>;
        onSelectSeason: (season: string | undefined) => void;
    }

    let {
        seasons,
        selectedSeason,
        stateBySeasonNumber,
        expectedBySeasonNumber,
        onSelectSeason
    }: Props = $props();
</script>

<Carousel.Root opts={{ dragFree: true, slidesToScroll: "auto" }}>
    <Carousel.Content>
        {#each seasons as season (season.id)}
            {@const rivenSeason = stateBySeasonNumber.get(season.number ?? 0)}
            {@const expectedCount = expectedBySeasonNumber?.get(season.number ?? 0)}
            {@const completedCount =
                rivenSeason?.episodes?.filter((e) => e.state === "Completed").length ?? 0}
            <Carousel.Item class="basis-auto">
                <button
                    onclick={() => onSelectSeason(season.number?.toString())}
                    class={cn(
                        "group relative block transition-all",
                        selectedSeason === season.number?.toString()
                            ? ""
                            : "opacity-60 hover:opacity-90"
                    )}>
                    <PortraitCard
                        title={season.number === 0 ? "Specials" : `Season ${season.number}`}
                        image={season.image}
                        selected={selectedSeason === season.number?.toString()}
                        class="w-28 md:w-32 lg:w-36">
                        {#snippet topRight()}
                            {#if rivenSeason?.state}
                                <StatusBadge state={rivenSeason.state} size="default" />
                            {/if}
                        {/snippet}
                    </PortraitCard>
                    {#if expectedCount != null && expectedCount > 0}
                        <div class="mt-1.5 flex items-center gap-1.5 px-0.5">
                            <div class="bg-muted h-1 flex-1 overflow-hidden rounded-full">
                                <div
                                    class="bg-primary h-full rounded-full transition-all duration-500"
                                    style="width: {Math.min(
                                        100,
                                        (completedCount / expectedCount) * 100
                                    )}%">
                                </div>
                            </div>
                            <span class="text-muted-foreground font-mono text-[10px]"
                                >{completedCount}/{expectedCount}</span>
                        </div>
                    {/if}
                </button>
            </Carousel.Item>
        {/each}
    </Carousel.Content>
</Carousel.Root>
