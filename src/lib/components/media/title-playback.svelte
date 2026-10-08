<script lang="ts">
    /**
     * A library title's playback, as the detail pages show it: how to start
     * it, what the release is in total, and -- for a multi-file release --
     * each file.
     *
     * One component in three places (`show`) because the three must agree:
     * the button that says "Resume 1:23:20 · file 3", the total it is a
     * second of, and the list that second falls in are the same numbers, and
     * `$lib/player/timeline` fetches them once for all three.
     *
     * Positions are seconds of the WHOLE title (`$lib/utils/parts`), the same
     * as the player reports them and riven-tv reads them.
     */
    import { Button } from "$lib/components/ui/button/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import PlayIcon from "@lucide/svelte/icons/play";
    import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
    import { formatBytes } from "$lib/helpers";
    import { openPlayer } from "$lib/stores/player.svelte";
    import { loadProgress, loadTimeline, type Progress, type Timeline } from "$lib/player/timeline";
    import { locate } from "$lib/utils/parts";
    import { MIN_RESUME_SECONDS } from "$lib/utils/playback";
    import { formatTime } from "$lib/utils/seek";

    interface Props {
        itemId: number;
        title: string;
        poster?: string | null;
        /** Which piece of the page this instance draws. */
        show: "actions" | "summary" | "files";
    }

    let { itemId, title, poster = null, show }: Props = $props();

    let timeline = $state<Timeline | null>(null);
    let progress = $state<Progress | null>(null);

    $effect(() => {
        const id = itemId;

        timeline = null;
        progress = null;

        void loadTimeline(id).then((value) => {
            if (id === itemId) timeline = value;
        });

        if (show === "actions") {
            void loadProgress(id).then((value) => {
                if (id === itemId) progress = value;
            });
        }
    });

    const files = $derived(timeline?.parts ?? []);
    const multi = $derived(files.length > 1);

    /** "3h 27m", the way the page states a running time. */
    function runtime(seconds: number | null): string | null {
        if (!seconds) return null;
        const h = Math.floor(seconds / 3600);
        const m = Math.round((seconds % 3600) / 60);
        return h ? `${h}h ${m}m` : `${m}m`;
    }

    // The same thresholds the player and the resume store use.
    const resumeAt = $derived.by(() => {
        if (!progress || progress.played) return 0;
        const at = Math.floor(progress.positionSeconds);
        if (at < MIN_RESUME_SECONDS) return 0;
        const end = timeline?.totalDuration;
        return end && at >= end - 5 ? 0 : at;
    });

    const resumeFile = $derived(
        resumeAt && multi && timeline?.totalDuration
            ? locate(
                  files.map((file) => file.duration),
                  resumeAt
              ).part + 1
            : null
    );
</script>

{#if show === "actions"}
    {#if resumeAt}
        <Button onclick={() => openPlayer(itemId, title, poster, resumeAt)}>
            <PlayIcon class="mr-2 size-4" />
            Resume {formatTime(resumeAt)}{#if resumeFile}<span class="ml-1.5 opacity-70"
                    >&middot; file {resumeFile}</span
                >{/if}
        </Button>
        <Button variant="outline" onclick={() => openPlayer(itemId, title, poster, 0)}>
            <RotateCcwIcon class="mr-2 size-4" />
            Start over
        </Button>
    {:else}
        <Button onclick={() => openPlayer(itemId, title, poster)}>
            <PlayIcon class="mr-2 size-4" />
            Play
        </Button>
    {/if}
{:else if show === "summary"}
    <!-- The whole release: what a multi-file torrent adds up to. -->
    {#if multi}
        <Badge variant="outline" class="font-mono text-xs">{files.length} files</Badge>
        <Badge variant="outline" class="font-mono text-xs"
            >{formatBytes(timeline?.totalSize ?? 0)}</Badge>
        {#if timeline?.totalDuration}
            <Badge variant="outline" class="font-mono text-xs"
                >{runtime(timeline.totalDuration)}</Badge>
        {/if}
    {/if}
{:else if multi && timeline}
    <div class="flex flex-col gap-2">
        <p class="text-primary font-mono text-xs font-semibold tracking-wider uppercase">
            Files &middot; {files.length} &middot; {formatBytes(
                timeline.totalSize
            )}{#if timeline.totalDuration}
                &middot; {formatTime(timeline.totalDuration)}{/if}
        </p>
        {#each files as file, at (file.index)}
            {@const start = timeline.starts[at]}
            <!--
                Each row plays the title from where that file begins. Only a
                start that is known can be offered; after a file of unknown
                length every later start would be a guess.
            -->
            <button
                type="button"
                disabled={start === null || start === undefined}
                onclick={() => openPlayer(itemId, title, poster, Math.ceil(start ?? 0))}
                aria-label="Play file {at + 1}, {file.title}"
                class="bg-muted/40 hover:bg-muted/70 flex items-center gap-3 rounded-lg p-3 text-left transition-colors disabled:cursor-default disabled:opacity-60">
                <span class="text-primary w-5 shrink-0 font-mono text-sm font-bold">{at + 1}</span>
                <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm">{file.title || file.filename}</span>
                    <span class="text-muted-foreground/70 block truncate font-mono text-xs"
                        >{file.filename}</span>
                </span>
                {#if file.duration}
                    <span class="text-muted-foreground shrink-0 font-mono text-xs tabular-nums"
                        >{formatTime(file.duration)}</span>
                {/if}
                <Badge variant="outline" class="shrink-0 font-mono text-xs"
                    >{formatBytes(file.file_size)}</Badge>
            </button>
        {/each}
    </div>
{/if}
