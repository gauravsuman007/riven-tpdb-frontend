<script lang="ts">
    import { Badge } from "$lib/components/ui/badge/index.js";
    import SectionHeading from "../section-heading.svelte";
    import type { FilesystemEntry, MediaMetadata } from "$lib/types/riven";

    interface Props {
        entries: FilesystemEntry[];
        fallbackMediaMetadata: MediaMetadata | undefined;
        selectedIndex: number;
        onDeleteEntry: (id: number, label: string) => void | Promise<void>;
    }

    let {
        entries,
        fallbackMediaMetadata,
        selectedIndex = $bindable(0),
        onDeleteEntry
    }: Props = $props();

    const formatSize = (b: number) => `${(b / 1073741824).toFixed(2)} GB`;

    function humanizeProfileName(name: string | undefined) {
        if (!name) return null;
        return name
            .split(/[_-]+/)
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");
    }

    function getMetadataResolutionLabel(metadata: MediaMetadata | undefined): string | null {
        const height = metadata?.video?.resolution_height;
        if (!height) return null;
        if (height >= 2160) return "4K";
        if (height >= 1440) return "1440p";
        if (height >= 1080) return "1080p";
        if (height >= 720) return "720p";
        if (height >= 480) return "480p";
        return `${height}p`;
    }

    function getFilesystemEntryLabel(
        entry: (FilesystemEntry & { ranking_profile_name?: string }) | undefined,
        fallback: string
    ) {
        const resolutionLabel = getMetadataResolutionLabel(entry?.media_metadata);
        const profileLabel = humanizeProfileName(entry?.ranking_profile_name);

        if (resolutionLabel && profileLabel) {
            return `${resolutionLabel} (${profileLabel})`;
        }

        return resolutionLabel ?? profileLabel ?? fallback;
    }
</script>

<div class="min-w-0 flex-1">
    <div class="mb-4 flex items-center justify-between gap-3">
        <SectionHeading title="File Information" />
        {#if entries.length > 1}
            <select
                onchange={(e) => {
                    selectedIndex = Number(e.currentTarget.value);
                }}
                class="bg-background border-border text-foreground rounded-md border px-2 py-1 font-mono text-xs">
                {#each entries as entry, i (i)}
                    <option value={i} selected={i === selectedIndex}
                        >{getFilesystemEntryLabel(entry, `Version ${i + 1}`)}</option>
                {/each}
            </select>
        {/if}
    </div>
    {#key selectedIndex}
        {@const fs = entries[selectedIndex < entries.length ? selectedIndex : 0] ?? entries[0]}
        {@const meta = fs?.media_metadata ?? fallbackMediaMetadata}
        {@const video = meta?.video}
        <div class="flex flex-col gap-6 text-sm">
            <!-- Filename -->
            {#if meta?.filename || fs?.original_filename}
                <div class="flex flex-col gap-1">
                    <p class="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                        Filename
                    </p>
                    <p class="text-foreground font-mono text-xs break-all">
                        {meta?.filename ?? fs?.original_filename}
                    </p>
                </div>
            {/if}

            <!-- Video -->
            {#if video}
                <div class="flex flex-col gap-2">
                    <span
                        class="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
                        >Video</span>
                    <div class="flex flex-wrap gap-2">
                        {#if video.resolution_width && video.resolution_height}<Badge
                                variant="secondary"
                                class="text-muted-foreground border border-white/10 bg-white/5 font-mono text-xs backdrop-blur-sm"
                                >{video.resolution_width}x{video.resolution_height}</Badge
                            >{/if}
                        {#if video.codec}<Badge
                                variant="secondary"
                                class="text-muted-foreground border border-white/10 bg-white/5 font-mono text-xs backdrop-blur-sm"
                                >{video.codec}</Badge
                            >{/if}
                        {#if video.bit_depth}<Badge
                                variant="secondary"
                                class="text-muted-foreground border border-white/10 bg-white/5 font-mono text-xs backdrop-blur-sm"
                                >{video.bit_depth}-bit</Badge
                            >{/if}
                        {#if video.hdr_type}<Badge
                                variant="secondary"
                                class="border border-purple-500/20 bg-purple-500/10 font-mono text-xs text-purple-200 backdrop-blur-sm"
                                >{video.hdr_type}</Badge
                            >{/if}
                        {#if video.frame_rate}<Badge
                                variant="secondary"
                                class="text-muted-foreground border border-white/10 bg-white/5 font-mono text-xs backdrop-blur-sm"
                                >{video.frame_rate} FPS</Badge
                            >{/if}
                    </div>
                </div>
            {/if}

            <!-- Audio -->
            {#if meta?.audio_tracks?.length}
                <div class="flex flex-col gap-2">
                    <span
                        class="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
                        >Audio</span>
                    <div class="flex flex-wrap gap-2">
                        {#each meta.audio_tracks as track, i (i)}
                            <Badge
                                variant="secondary"
                                class="text-muted-foreground border border-white/10 bg-white/5 font-mono text-xs backdrop-blur-sm"
                                >{track.codec}{track.channels
                                    ? track.channels === 8
                                        ? " 7.1"
                                        : track.channels === 6
                                          ? " 5.1"
                                          : ` ${track.channels}ch`
                                    : ""}{track.language
                                    ? ` (${track.language.toUpperCase()})`
                                    : ""}</Badge>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Subtitles -->
            {#if meta?.subtitle_tracks?.length}
                <div class="flex flex-col gap-2">
                    <span
                        class="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
                        >Subtitles</span>
                    <div class="flex flex-wrap gap-2">
                        {#each meta.subtitle_tracks as track, i (i)}
                            <Badge
                                variant="secondary"
                                class="text-muted-foreground border border-white/10 bg-white/5 text-[10px] backdrop-blur-sm"
                                >{track.language ? track.language.toUpperCase() : "Unknown"}</Badge>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Source -->
            {#if meta?.quality_source || meta?.is_remux || meta?.is_proper || meta?.is_repack}
                <div class="flex flex-col gap-2">
                    <span
                        class="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
                        >Source</span>
                    <div class="flex flex-wrap gap-2">
                        {#if meta?.quality_source}<Badge
                                variant="secondary"
                                class="border border-blue-500/20 bg-blue-500/10 text-xs font-bold text-blue-200 backdrop-blur-sm"
                                >{meta.quality_source}</Badge
                            >{/if}
                        {#if meta?.is_remux}<Badge
                                variant="secondary"
                                class="border border-amber-500/20 bg-amber-500/10 text-xs font-bold text-amber-200 backdrop-blur-sm"
                                >REMUX</Badge
                            >{/if}
                        {#if meta?.is_proper}<Badge
                                variant="secondary"
                                class="border border-green-500/20 bg-green-500/10 text-xs font-bold text-green-200 backdrop-blur-sm"
                                >PROPER</Badge
                            >{/if}
                        {#if meta?.is_repack}<Badge
                                variant="secondary"
                                class="border border-green-500/20 bg-green-500/10 text-xs font-bold text-green-200 backdrop-blur-sm"
                                >REPACK</Badge
                            >{/if}
                    </div>
                </div>
            {/if}

            <!-- Metrics -->
            {#if fs?.file_size || meta?.bitrate || meta?.duration}
                <div class="flex flex-col gap-2">
                    <span
                        class="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
                        >Metrics</span>
                    <div class="flex flex-wrap gap-4">
                        {#if fs?.file_size}
                            <div class="flex items-center gap-2">
                                <span class="text-muted-foreground text-xs">Size</span>
                                <span class="text-foreground font-mono"
                                    >{formatSize(fs.file_size)}</span>
                            </div>
                        {/if}
                        {#if meta?.bitrate}
                            <div class="flex items-center gap-2">
                                <span class="text-muted-foreground text-xs">Bitrate</span>
                                <span class="text-foreground font-mono"
                                    >{Math.round(meta.bitrate / 1000000)} Mbps</span>
                            </div>
                        {/if}
                        {#if meta?.duration}
                            <div class="flex items-center gap-2">
                                <span class="text-muted-foreground text-xs">Duration</span>
                                <span class="text-foreground font-mono"
                                    >{Math.floor(meta.duration / 60)}m {meta.duration % 60}s</span>
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}

            <!-- Container -->
            {#if meta?.container_format?.length}
                <div class="flex flex-col gap-2">
                    <span
                        class="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
                        >Container</span>
                    <div class="flex flex-wrap gap-2">
                        {#each meta.container_format as fmt (fmt)}
                            <Badge
                                variant="secondary"
                                class="text-muted-foreground border border-white/10 bg-white/5 font-mono text-xs backdrop-blur-sm"
                                >{fmt}</Badge>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Provider -->
            {#if fs?.provider || fs?.plugin}
                <div class="flex flex-col gap-2">
                    <span
                        class="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
                        >Provider</span>
                    <div class="flex flex-wrap gap-2">
                        {#if fs?.provider}<Badge
                                variant="secondary"
                                class="text-muted-foreground border border-white/10 bg-white/5 font-mono text-xs backdrop-blur-sm"
                                >{fs.provider}</Badge
                            >{/if}
                        {#if fs?.plugin}<Badge
                                variant="secondary"
                                class="text-muted-foreground border border-white/10 bg-white/5 font-mono text-xs backdrop-blur-sm"
                                >{fs.plugin}</Badge
                            >{/if}
                    </div>
                </div>
            {/if}

            <!-- Download (full file to local disk; works for debrid + usenet) -->
            {#if fs?.id}
                <div class="flex flex-col gap-2">
                    <span
                        class="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
                        >Download</span>
                    <div class="flex flex-wrap gap-2">
                        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
                        <a
                            href={`/media/${fs.id}`}
                            download={fs.original_filename ?? ""}
                            rel="external"
                            class="text-foreground rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/10"
                            >Download</a>
                    </div>
                </div>
            {/if}

            <!-- Delete version -->
            {#if entries.length > 1 && fs?.id}
                <button
                    type="button"
                    class="text-destructive/70 hover:text-destructive border-destructive/30 hover:border-destructive/70 mt-2 rounded-md border px-3 py-1.5 text-xs transition-colors"
                    onclick={() =>
                        onDeleteEntry(
                            fs!.id!,
                            getFilesystemEntryLabel(fs, `Version ${selectedIndex + 1}`)
                        )}>
                    Remove this version
                </button>
            {/if}
        </div>
    {/key}
</div>
