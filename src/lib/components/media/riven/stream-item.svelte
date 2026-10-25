<script lang="ts">
    import * as Card from "$lib/components/ui/card/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Checkbox } from "$lib/components/ui/checkbox/index.js";
    import type { Stream } from "$lib/types";
    import ReleaseMeta from "./release-meta.svelte";
    import LoaderIcon from "@lucide/svelte/icons/loader-circle";

    interface Props {
        stream: Stream;
        magnet: string;
        isSelected: boolean;
        onSelect: (magnet: string) => void;
        onScrape: (magnet: string) => void;
        showCheckbox?: boolean;
        /** This release is the one being picked right now. */
        busy?: boolean;
        /** Some pick is in progress: further clicks are ignored, visibly. */
        locked?: boolean;
    }

    let {
        stream,
        magnet,
        isSelected,
        onSelect,
        onScrape,
        showCheckbox = true,
        busy = false,
        locked = false
    }: Props = $props();

    function getResolutionColor(resolution?: string): string {
        if (!resolution) return "bg-primary text-primary-foreground";
        if (resolution.includes("2160")) return "bg-chart-5 text-primary-foreground";
        if (resolution.includes("1440")) return "bg-chart-4 text-primary-foreground";
        if (resolution.includes("1080")) return "bg-chart-2 text-primary-foreground";
        if (resolution.includes("720")) return "bg-chart-3 text-primary-foreground";
        return "bg-primary text-primary-foreground";
    }
</script>

<div class="flex items-start gap-3">
    {#if showCheckbox}
        <Checkbox checked={isSelected} onCheckedChange={() => onSelect(magnet)} class="mt-4" />
    {/if}
    <!--
        A filtered-out release is dimmed and outlined, never hidden and never
        disabled: it was shown because someone asked to see it, and the reason
        to show it is so they can pick it anyway.
    -->
    <Card.Root
        class="border-border flex-1 transition-all {busy
            ? 'border-primary shadow-md'
            : locked
              ? 'cursor-wait opacity-50'
              : 'hover:border-primary cursor-pointer hover:shadow-md'} {stream.filtered && !busy
            ? 'border-dashed opacity-60 hover:opacity-100'
            : ''}"
        aria-busy={busy}
        onclick={() => {
            // A pick can take several seconds (a capped tracker's .torrent is
            // fetched first); a second click used to start a second pick.
            if (!locked) onScrape(magnet);
        }}>
        <Card.Content class="px-4 py-3">
            <div class="flex flex-col gap-2">
                {#if busy}
                    <p class="text-primary flex items-center gap-2 text-sm font-medium" role="status">
                        <LoaderIcon class="size-4 animate-spin" />
                        {stream.unresolved
                            ? "Fetching this release's torrent from the tracker…"
                            : "Queuing this release…"}
                    </p>
                {/if}
                <div class="flex items-start justify-between gap-2">
                    <p class="text-foreground min-w-0 flex-1 text-sm font-medium break-all">
                        {stream.raw_title}
                    </p>
                    <Badge variant={stream.rank > 0 ? "default" : "destructive"} class="shrink-0">
                        Rank: {stream.rank}
                    </Badge>
                </div>

                {#if stream.filtered}
                    <!--
                        The evidence the matcher weighed, verbatim. A bare
                        "filtered" label would leave the viewer exactly as
                        unable to judge the call as an empty list did.
                    -->
                    <div class="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" class="border-destructive text-destructive">
                            Filtered out
                        </Badge>
                        {#if stream.filter_reason}
                            <span class="text-muted-foreground text-xs">
                                {stream.filter_reason}
                            </span>
                        {/if}
                    </div>
                {/if}

                <div class="flex flex-wrap gap-2">
                    {#if stream.parsed_data.resolution}
                        <Badge class={getResolutionColor(stream.parsed_data.resolution)}>
                            {stream.parsed_data.resolution}
                        </Badge>
                    {/if}
                    {#if stream.parsed_data.quality}
                        <Badge variant="outline" class="border-border text-muted-foreground"
                            >{stream.parsed_data.quality}</Badge>
                    {/if}
                    {#if stream.parsed_data.hdr}
                        {#each stream.parsed_data.hdr as hdr (hdr)}
                            <Badge variant="outline" class="border-border text-muted-foreground"
                                >{hdr}</Badge>
                        {/each}
                    {/if}
                    {#if stream.parsed_data.codec}
                        <Badge variant="outline" class="border-border text-muted-foreground"
                            >{stream.parsed_data.codec.toUpperCase()}</Badge>
                    {/if}
                    {#if stream.parsed_data.audio}
                        {#each stream.parsed_data.audio as audio (audio)}
                            <Badge variant="outline" class="border-border text-muted-foreground"
                                >{audio}</Badge>
                        {/each}
                    {/if}
                    {#if stream.parsed_data.languages}
                        {#each stream.parsed_data.languages as lang (lang)}
                            <Badge variant="outline" class="border-border text-muted-foreground"
                                >{lang.toUpperCase()}</Badge>
                        {/each}
                    {/if}
                    {#if stream.is_cached}
                        <Badge class="bg-chart-1 text-primary-foreground">Cached</Badge>
                    {/if}
                    {#if stream.unresolved}
                        <Badge
                            variant="outline"
                            class="border-amber-500/60 text-amber-600 dark:text-amber-400"
                            title="{stream.indexer ?? 'This indexer'} limits .torrent downloads per day, so this release has not been downloaded. Picking it uses one.">
                            Uses 1 download
                        </Badge>
                    {/if}
                    <!--
                        Choosing a release here is the same decision as choosing
                        one on the detail page, so it gets the same numbers: how
                        many peers are actually seeding it, how big it is, and
                        which indexer vouched for it. Without them the only
                        signal was a rank computed from the filename.
                    -->
                    <ReleaseMeta
                        seeders={stream.seeders}
                        leechers={stream.leechers}
                        size={stream.size}
                        indexer={stream.indexer}
                        textClass="text-xs" />
                </div>
            </div>
        </Card.Content>
    </Card.Root>
</div>
