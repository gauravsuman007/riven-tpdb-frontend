<!--
    Swarm, size and indexer for one release, as the indexer reported them at
    scrape time.

    Shared between the detail page's candidate list and the manual scrape
    results so the same release reads the same way in both places -- picking a
    release to download is the same decision on either screen, and it should
    not be informed by different numbers.

    Every value is optional and simply absent when the indexer did not report
    it. Rendering an unknown seeder count as "0 seeds" would be a claim the
    data does not support, and specifically the claim that turns a healthy
    release into one the user avoids.
-->
<script lang="ts">
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { formatBytes } from "$lib/helpers";
    import { cn } from "$lib/utils";

    interface Props {
        seeders?: number | null;
        leechers?: number | null;
        size?: number | null;
        indexer?: string | null;
        /** Tailwind text size, so this fits both a dense list and a card. */
        textClass?: string;
    }

    let {
        seeders = null,
        leechers = null,
        size = null,
        indexer = null,
        textClass = "text-[10px]"
    }: Props = $props();

    const hasSeeders = $derived(seeders !== null && seeders !== undefined);
    const hasLeechers = $derived(leechers !== null && leechers !== undefined);

    // A release nobody is seeding is the single best predictor of a download
    // that never starts, so it is coloured as a warning rather than left as
    // one more neutral number to read past.
    const dead = $derived(hasSeeders && seeders === 0);
</script>

{#if hasSeeders}
    <Badge
        variant="outline"
        class={cn(
            "font-mono",
            textClass,
            dead ? "border-red-500/40 text-red-500" : "text-muted-foreground/80"
        )}
        title={dead
            ? "No seeders reported. Your debrid provider may still hold a cached copy, but nothing will download from the swarm."
            : "Seeders reported by the indexer when this title was scraped."}>
        {seeders} seed{seeders === 1 ? "" : "s"}{#if hasLeechers}&nbsp;/ {leechers} leech{/if}
    </Badge>
{/if}
{#if size}
    <Badge variant="outline" class={cn("text-muted-foreground/80 font-mono", textClass)}>
        {formatBytes(size)}
    </Badge>
{/if}
{#if indexer}
    <Badge
        variant="outline"
        class={cn("text-muted-foreground/80", textClass)}
        title="The indexer this release came from.">
        {indexer}
    </Badge>
{/if}
