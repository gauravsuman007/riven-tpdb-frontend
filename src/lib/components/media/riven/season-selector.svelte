<script lang="ts">
    import ChevronRight from "@lucide/svelte/icons/chevron-right";
    import ChevronDown from "@lucide/svelte/icons/chevron-down";

    export interface EpisodeInfo {
        number: number;
        name: string;
    }

    export interface SeasonInfo {
        id: number;
        season_number: number;
        episode_count: number;
        completed_count?: number;
        name: string;
        status?: string;
        episodes?: EpisodeInfo[];
    }

    interface Props {
        seasons: SeasonInfo[];
        selectedSeasons: number[];
        selectedEpisodes?: Record<number, number[]>;
        onToggle: (seasonNumber: number) => void;
        onToggleEpisode?: (seasonNumber: number, episodeNumber: number) => void;
        class?: string;
    }

    let {
        seasons,
        selectedSeasons,
        selectedEpisodes = {},
        onToggle,
        onToggleEpisode,
        class: className = ""
    }: Props = $props();

    let expanded = $state<Set<number>>(new Set());

    function isSeasonLocked(season: SeasonInfo): boolean {
        return season.status === "Available";
    }

    function toggleExpanded(seasonNumber: number) {
        const next = new Set(expanded);
        if (next.has(seasonNumber)) {
            next.delete(seasonNumber);
        } else {
            next.add(seasonNumber);
        }
        expanded = next;
    }
</script>

<div class="{className} flex max-h-60 w-full flex-col gap-0.5 overflow-y-auto">
    {#each seasons as season (season.id)}
        {@const locked = isSeasonLocked(season)}
        {@const selected = selectedSeasons.includes(season.season_number)}
        {@const partialEpisodes = selectedEpisodes[season.season_number] ?? []}
        {@const hasEpisodes = (season.episodes?.length ?? 0) > 0 && !locked}
        {@const isExpanded = expanded.has(season.season_number)}
        <div>
            <div
                class="group hover:bg-muted/30 flex w-full items-center justify-between gap-2 rounded-md px-1 py-1.5 text-sm transition-all {locked
                    ? 'opacity-50'
                    : ''}">
                <div class="flex min-w-0 flex-1 items-center gap-1">
                    {#if hasEpisodes}
                        <button
                            type="button"
                            class="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5"
                            onclick={() => toggleExpanded(season.season_number)}
                            aria-label={isExpanded ? "Collapse episodes" : "Expand episodes"}>
                            {#if isExpanded}
                                <ChevronDown class="h-3.5 w-3.5" />
                            {:else}
                                <ChevronRight class="h-3.5 w-3.5" />
                            {/if}
                        </button>
                    {/if}
                    <button
                        type="button"
                        class="flex flex-1 cursor-pointer items-center truncate px-2 py-1 text-left disabled:cursor-not-allowed {(selected ||
                            partialEpisodes.length > 0) &&
                        !locked
                            ? 'text-primary font-bold'
                            : 'text-foreground font-medium'}"
                        onclick={() => onToggle(season.season_number)}
                        disabled={locked}
                        title={season.name}>
                        <span>Season {season.season_number}</span>
                        {#if partialEpisodes.length > 0 && !selected}
                            <span class="text-primary/70 ml-1.5 text-xs font-normal"
                                >({partialEpisodes.length} ep{partialEpisodes.length === 1
                                    ? ""
                                    : "s"})</span>
                        {/if}
                    </button>
                </div>

                {#if locked}
                    <span class="text-xs font-normal opacity-70">Complete</span>
                {:else if season.completed_count != null && season.episode_count > 0}
                    <span class="text-muted-foreground text-xs font-normal opacity-70"
                        >{season.completed_count}/{season.episode_count} eps</span>
                {:else}
                    <span class="text-muted-foreground text-xs font-normal opacity-70"
                        >{season.episode_count} eps</span>
                {/if}
            </div>

            {#if hasEpisodes && isExpanded}
                <div class="ml-5 flex flex-col gap-0.5 border-l border-white/10 pl-2">
                    {#each season.episodes ?? [] as episode (episode.number)}
                        {@const episodeSelected =
                            selected || partialEpisodes.includes(episode.number)}
                        <button
                            type="button"
                            class="hover:bg-muted/30 flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-all disabled:cursor-not-allowed disabled:opacity-60 {episodeSelected
                                ? 'text-primary font-semibold'
                                : 'text-muted-foreground'}"
                            onclick={() => onToggleEpisode?.(season.season_number, episode.number)}
                            disabled={selected}
                            title={episode.name}>
                            <span class="shrink-0">E{episode.number}</span>
                            <span class="truncate">{episode.name}</span>
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
    {/each}
</div>
