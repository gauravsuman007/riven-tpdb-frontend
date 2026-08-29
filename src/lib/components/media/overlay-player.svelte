<script lang="ts">
    /**
     * Fullscreen-capable overlay player with free zoom.
     *
     * The zoom layer is modelled on MX Player: the video can be scaled past
     * "fit" until it fills the screen edge to edge, cropping rather than
     * letterboxing. Zoom is applied as a CSS transform on a wrapper around the
     * <video>, so it costs nothing at the decode level and the native controls
     * keep working underneath.
     *
     * Gestures, and why each exists:
     *   - two fingers        : zoom and pan together, anchored on the midpoint
     *                          between them so the content under the fingers
     *                          stays put. Pan is part of this gesture, not a
     *                          separate one-finger mode
     *   - one finger, across : seeks, at a rate that follows the swipe's own
     *                          momentum, so one gesture covers both a nudge
     *                          and a jump across the film. Fullscreen only,
     *                          but available at any zoom level -- the picture
     *                          is moved with two fingers, so one is free
     *   - mouse drag         : pans while zoomed. A mouse has no second
     *                          finger, so it keeps the one-pointer pan
     *   - double tap/click   : toggles between fit and fill
     *   - wheel              : desktop zoom, anchored on the pointer
     *
     * Zoom runs from fit (the whole frame, letterboxed) to cover (the bars
     * exactly gone) and stops there. Zooming past cover only discards picture.
     */
    import { onDestroy } from "svelte";
    import { player } from "$lib/stores/player.svelte";
    import { toGuid } from "$lib/utils/jellyfin-ids";
    import VideoPlayer from "./video-player.svelte";
    import XIcon from "@lucide/svelte/icons/x";
    import PlayIcon from "@lucide/svelte/icons/play";
    import PauseIcon from "@lucide/svelte/icons/pause";
    import ShareIcon from "@lucide/svelte/icons/share";
    import Volume2Icon from "@lucide/svelte/icons/volume-2";
    import VolumeXIcon from "@lucide/svelte/icons/volume-x";
    import MaximizeIcon from "@lucide/svelte/icons/maximize";
    import MinimizeIcon from "@lucide/svelte/icons/minimize";
    import ZoomInIcon from "@lucide/svelte/icons/zoom-in";
    import ZoomOutIcon from "@lucide/svelte/icons/zoom-out";
    import {
        MIN_SCALE,
        clampTransform,
        coverScale,
        midpoint,
        pinchDistance,
        twoFingerTransform,
        zoomAt as computeZoom,
        type GestureStart,
        type Transform,
        type Viewport
    } from "$lib/utils/zoom";
    import {
        SEEK_THRESHOLD_PX,
        clampTime,
        flingBonus,
        formatOffset,
        formatTime,
        releaseVelocity,
        seekDelta,
        velocityBetween,
        type Sample
    } from "$lib/utils/seek";

    let container = $state<HTMLDivElement | undefined>();
    let stage = $state<HTMLDivElement | undefined>();
    let video = $state<HTMLVideoElement | undefined>();

    let scale = $state(1);
    let offsetX = $state(0);
    let offsetY = $state(0);
    let isFullscreen = $state(false);

    // Frame size, tracked so the zoom ceiling can follow the actual video
    // rather than a guess. Zero until metadata arrives.
    let videoWidth = $state(0);
    let videoHeight = $state(0);

    // Swipe-to-seek bookkeeping.
    let seekStart = $state<{ x: number; y: number; time: number } | null>(null);
    let seekOffset = $state(0);
    let seekSamples: Sample[] = [];
    let seeking = $state(false);

    // Controls fade out during fullscreen playback so only the picture is left.
    let controlsVisible = $state(true);
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    // Playback state, mirrored from the element because the control bar is
    // ours now rather than the browser's.
    let paused = $state(true);
    let muted = $state(false);
    let currentTime = $state(0);
    let duration = $state(0);
    // The file's real duration from ffprobe, bound from VideoPlayer. Preferred
    // over `video.duration` whenever set -- see the prop's doc comment for why
    // the element's own value can be badly wrong for a non-faststart file.
    let probedDuration = $state<number | undefined>(undefined);
    let buffered = $state(0);
    let scrubbing = $state(false);

    // Gesture bookkeeping. `pinchStartDistance` and `panStart` are reactive
    // because the transform reads them to disable its transition mid-gesture --
    // an eased transform would lag the fingers.
    let pointers = new Map<number, { x: number; y: number }>();
    let pinchStartDistance = $state(0);
    let panStart = $state<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
    // Everything the two-finger gesture needs to map its start state onto the
    // current fingers in one step, rather than accumulating per move.
    let pinchStart: GestureStart | null = null;
    let lastTap = 0;

    const target = $derived(player.current);

    /** How long the chrome stays up after the last interaction, in fullscreen. */
    const CONTROLS_HIDE_MS = 3000;

    /**
     * Height reserved for this component's own control bar at the bottom of
     * the stage, so a drag that starts on the scrubber is not also read as a
     * swipe-seek.
     */
    const CONTROLS_BAND_PX = 96;

    // Position preview shown while a swipe is in flight.
    const seekPreview = $derived.by(() => {
        if (!seeking || !video) return null;

        const from = seekStart?.time ?? 0;

        return {
            offset: formatOffset(seekOffset),
            target: formatTime(clampTime(from + seekOffset, video.duration))
        };
    });

    /** Stage geometry, read fresh: the viewport changes on rotate/fullscreen. */
    function viewport(): Viewport | null {
        if (!stage) return null;

        const rect = stage.getBoundingClientRect();
        return { width: rect.width, height: rect.height, left: rect.left, top: rect.top };
    }

    function current(): Transform {
        return { scale, offsetX, offsetY };
    }

    /**
     * The most this video may be zoomed: exactly enough to remove the bars.
     *
     * Recomputed rather than cached because it depends on the stage, which
     * changes on rotate and on entering fullscreen.
     */
    function maxScale(): number {
        const view = viewport();
        if (!view) return MIN_SCALE;

        return coverScale(view, videoWidth, videoHeight);
    }

    function apply(next: Transform) {
        scale = next.scale;
        offsetX = next.offsetX;
        offsetY = next.offsetY;
    }

    function clampOffsets() {
        const view = viewport();
        if (view) apply(clampTransform(view, current(), maxScale(), videoWidth, videoHeight));
    }

    function zoomAt(nextScale: number, clientX: number, clientY: number) {
        const view = viewport();
        if (!view) return;

        apply(
            computeZoom(
                view,
                current(),
                nextScale,
                clientX,
                clientY,
                maxScale(),
                videoWidth,
                videoHeight
            )
        );
    }

    /** Centre of the stage, for zoom that is not anchored on a pointer. */
    function stageCentre(): [number, number] {
        const view = viewport();
        if (!view) return [0, 0];
        return [view.left + view.width / 2, view.top + view.height / 2];
    }

    function zoomBy(factor: number) {
        const [cx, cy] = stageCentre();
        zoomAt(scale * factor, cx, cy);
    }

    function reset() {
        scale = 1;
        offsetX = 0;
        offsetY = 0;
    }

    /**
     * Show the chrome, and start the countdown to hiding it again.
     *
     * Only fullscreen hides: in the windowed overlay the bar is the only way
     * back out, and a bar that vanishes from a window is just a lost button.
     */
    function showControls() {
        controlsVisible = true;

        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = null;

        if (!isFullscreen) return;

        hideTimer = setTimeout(() => {
            // Never hide mid-gesture, or the viewer loses the seek readout
            // they are steering by.
            if (seeking || panStart || pinchStartDistance) {
                showControls();
                return;
            }

            controlsVisible = false;
        }, CONTROLS_HIDE_MS);
    }

    /** Read the frame size once the browser knows it. */
    function syncMetadata() {
        if (!video) return;

        videoWidth = video.videoWidth || 0;
        videoHeight = video.videoHeight || 0;

        // A rotate or a fullscreen change can leave the current zoom above the
        // new ceiling; pull it back rather than showing an over-cropped frame.
        clampOffsets();
    }

    function applyTwoFinger(centre: { x: number; y: number }, ratio: number) {
        const view = viewport();
        if (!view || !pinchStart) return;

        apply(
            twoFingerTransform(
                view,
                pinchStart,
                centre,
                ratio,
                maxScale(),
                videoWidth,
                videoHeight
            )
        );
    }

    /** Drop a seek in progress without applying it. */
    function abandonSeek() {
        seekStart = null;
        seekSamples = [];
        seeking = false;
        seekOffset = 0;
    }

    function onPointerDown(event: PointerEvent) {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            const centre = midpoint(a, b);

            pinchStartDistance = pinchDistance(a, b);
            pinchStart = {
                scale,
                midX: centre.x,
                midY: centre.y,
                offsetX,
                offsetY
            };
            panStart = null;

            // A second finger means the gesture was never a seek. Abandon it
            // rather than committing whatever the first finger had accumulated.
            abandonSeek();
        } else if (pointers.size === 1 && event.pointerType === "mouse" && scale > MIN_SCALE) {
            // A mouse has no second pointer, so it keeps one-button panning.
            panStart = { x: event.clientX, y: event.clientY, offsetX, offsetY };
        } else if (pointers.size === 1 && canSeek() && !onControlBar(event)) {
            seekStart = { x: event.clientX, y: event.clientY, time: video?.currentTime ?? 0 };
            seekSamples = [{ x: event.clientX, t: event.timeStamp }];
            seekOffset = 0;
        }

        showControls();
    }

    function onPointerMove(event: PointerEvent) {
        // Before the tracking guard: a mouse moving over the picture is not a
        // tracked pointer, but it is exactly the signal that someone is there.
        showControls();

        if (!pointers.has(event.pointerId)) return;

        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (pointers.size === 2 && pinchStartDistance > 0 && pinchStart) {
            const [a, b] = [...pointers.values()];
            const centre = midpoint(a, b);
            const ratio = pinchDistance(a, b) / pinchStartDistance;

            // Prevent the browser treating this as a page pinch-zoom.
            event.preventDefault();
            applyTwoFinger(centre, ratio);
            return;
        }

        if (panStart && pointers.size === 1) {
            event.preventDefault();
            offsetX = panStart.offsetX + (event.clientX - panStart.x);
            offsetY = panStart.offsetY + (event.clientY - panStart.y);
            clampOffsets();
            return;
        }

        // Once zoomed, a one-finger swipe is still a seek: panning moved to
        // two fingers precisely so this stays available.

        if (seekStart && pointers.size === 1) {
            const totalX = event.clientX - seekStart.x;
            const totalY = event.clientY - seekStart.y;

            // Wait until the gesture has declared itself. Committing to a seek
            // on the first pixel would hijack a vertical scroll and every tap.
            if (!seeking) {
                if (Math.abs(totalX) < SEEK_THRESHOLD_PX) return;

                // A mostly-vertical drag is not a seek; let it go.
                if (Math.abs(totalY) > Math.abs(totalX)) {
                    seekStart = null;
                    return;
                }

                seeking = true;
            }

            event.preventDefault();

            const previous = seekSamples[seekSamples.length - 1];
            const sample: Sample = { x: event.clientX, t: event.timeStamp };

            // Accumulate per step rather than scaling the total distance, so
            // the gain reflects how fast the finger is moving *now*: slowing
            // down at the end of a flick lands the last pixels precisely.
            seekOffset += seekDelta(sample.x - previous.x, velocityBetween(previous, sample));
            seekSamples.push(sample);

            if (seekSamples.length > 24) seekSamples.shift();
        }
    }

    function endPointer(event: PointerEvent) {
        pointers.delete(event.pointerId);

        if (pointers.size < 2) {
            pinchStartDistance = 0;
            pinchStart = null;
        }
        if (pointers.size === 0) {
            panStart = null;
            commitSeek();
        }
    }

    /**
     * Is this pointer landing on the control bar rather than the picture?
     *
     * The scrubber is also dragged horizontally, so without this a drag on it
     * would scrub *and* run the swipe-seek, fighting each other.
     */
    function onControlBar(event: PointerEvent): boolean {
        if (!controlsVisible) return false;

        const view = viewport();
        if (!view) return false;

        return event.clientY > view.top + view.height - CONTROLS_BAND_PX;
    }

    function togglePlay() {
        if (!video) return;

        if (video.paused) video.play().catch(() => {});
        else video.pause();

        showControls();
    }

    function toggleMute() {
        if (!video) return;

        video.muted = !video.muted;
        muted = video.muted;
        showControls();
    }

    /** Mirror the element's state into the component. */
    function syncPlayback() {
        if (!video) return;

        paused = video.paused;
        muted = video.muted;
        duration =
            probedDuration ?? (Number.isFinite(video.duration) ? video.duration : 0);

        // While scrubbing, the readout follows the finger, not the element --
        // otherwise it snaps back on every timeupdate mid-drag.
        if (!scrubbing && !seeking) currentTime = video.currentTime;

        try {
            buffered = video.buffered.length
                ? video.buffered.end(video.buffered.length - 1)
                : 0;
        } catch {
            // `buffered` throws while the media is still being set up.
            buffered = 0;
        }
    }

    /** Seek from a click or drag anywhere along the scrubber. */
    function scrubTo(event: PointerEvent, bar: HTMLElement) {
        if (!video || !duration) return;

        const rect = bar.getBoundingClientRect();
        const ratio = rect.width ? (event.clientX - rect.left) / rect.width : 0;

        currentTime = clampTime(ratio * duration, duration);
        video.currentTime = currentTime;
        showControls();
    }

    /**
     * True where a one-finger horizontal drag should scrub.
     *
     * Zoom level is deliberately not part of this. Panning lives on two
     * fingers, so seeking stays on one at every zoom level -- a swipe should
     * not silently change meaning because the picture happens to be zoomed.
     */
    function canSeek(): boolean {
        return isFullscreen && !!video && Number.isFinite(video.duration);
    }

    /**
     * Apply the accumulated seek, plus whatever the release velocity earns.
     *
     * The fling is added as a one-off rather than animated: the seek commits on
     * release, and a position that kept sliding afterwards would be one the
     * viewer could no longer influence.
     */
    function commitSeek() {
        if (!seekStart) return;

        const start = seekStart;
        const wasSeeking = seeking;
        const total = seekOffset + flingBonus(releaseVelocity(seekSamples));

        seekStart = null;
        seekSamples = [];
        seeking = false;
        seekOffset = 0;

        if (!wasSeeking || !video) return;

        video.currentTime = clampTime(start.time + total, video.duration);
        showControls();
    }

    function onDoubleToggle(clientX: number, clientY: number) {
        if (scale > MIN_SCALE) {
            reset();
            return;
        }

        // "Fill the screen": exactly enough zoom that the letterboxing is gone.
        zoomAt(maxScale(), clientX, clientY);
    }

    function onWheel(event: WheelEvent) {
        if (!event.ctrlKey && scale === MIN_SCALE) return;

        event.preventDefault();
        zoomAt(scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15), event.clientX, event.clientY);
    }

    function onPointerUp(event: PointerEvent) {
        const wasPinching = pointers.size === 2;
        // Read before endPointer, which commits and clears the seek.
        const wasSeeking = seeking;

        endPointer(event);

        // A swipe is not a tap. Without this, two quick swipes land inside the
        // double-tap window and zoom the picture instead of seeking twice.
        if (wasPinching || wasSeeking || event.pointerType === "mouse") return;

        const now = Date.now();

        if (now - lastTap < 300) {
            onDoubleToggle(event.clientX, event.clientY);
            lastTap = 0;
        } else {
            lastTap = now;
        }
    }

    async function toggleFullscreen() {
        if (!container) return;

        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            } else {
                await container.requestFullscreen();
            }
        } catch {
            // Safari on iPhone refuses fullscreen on non-video elements. The
            // overlay already covers the viewport, so this is cosmetic.
            isFullscreen = !isFullscreen;
        }
    }

    function syncFullscreen() {
        // If the video element itself somehow entered fullscreen -- a stray
        // native affordance, a gesture on some Android builds -- hand it back
        // and fullscreen the overlay instead. The browser presents fullscreen
        // video with its own zoom-to-fill, which crops the frame and cannot be
        // overridden from the page.
        if (video && document.fullscreenElement === video) {
            document.exitFullscreen().then(
                () => container?.requestFullscreen().catch(() => {}),
                () => {}
            );
            return;
        }

        isFullscreen = !!document.fullscreenElement;

        // Entering fullscreen changes the stage aspect, so the ceiling moves.
        // Starting from fit is the point: the whole frame, then zoom in if the
        // viewer wants the bars gone.
        reset();
        showControls();
    }

    function close() {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        reset();
        player.close();
    }

    function onKeydown(event: KeyboardEvent) {
        if (!target) return;

        if (event.key === "Escape" && !document.fullscreenElement) close();
        if (event.key === "f") toggleFullscreen();
        if (event.key === "0") reset();
        if (event.key === "m") toggleMute();

        // The native control bar is gone, so its keyboard behaviour has to be
        // provided here.
        if (event.key === " " || event.key === "k") {
            event.preventDefault();
            togglePlay();
        }

        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            if (!video) return;

            event.preventDefault();
            video.currentTime = clampTime(
                video.currentTime + (event.key === "ArrowRight" ? 10 : -10),
                video.duration
            );
            showControls();
        }
    }

    
    /**
     * Whether we can open the current video in an external player.
     * True when: (1) external player is available on the Jellyfin shell,
     * or (2) no shell (browser playback).
     */
    let canOpenExternal = $derived(!!target);

    function openInExternal() {
        if (!target) return;

        if (target.kind === "library" && "itemId" in target) {
            // Library item: use the Jellyfin bridge's external player flow
            window.RivenNative?.play(toGuid(target.itemId));
        } else if (target.kind === "direct" && "src" in target) {
            // Direct web link: hand over the scraped URL to the external player
            const absolute = new URL(target.src, window.location.href).href;
            if (window.RivenNative?.externalPlayerSelected?.()) {
                window.RivenNative.openExternal(absolute);
            }
        }
    }

    $effect(() => {
        // Reset zoom whenever a different title is opened, so one title's zoom
        // does not carry into the next.
        if (target) {
            reset();
            videoWidth = 0;
            videoHeight = 0;
            probedDuration = undefined;
            showControls();
        }
    });

    $effect(() => {
        if (!video) return;

        const element = video;
        const playbackEvents = [
            "loadedmetadata",
            "durationchange",
            "timeupdate",
            "progress",
            "play",
            "pause",
            "volumechange"
        ];

        element.addEventListener("loadedmetadata", syncMetadata);
        element.addEventListener("resize", syncMetadata);
        for (const name of playbackEvents) element.addEventListener(name, syncPlayback);

        syncMetadata();
        syncPlayback();

        return () => {
            element.removeEventListener("loadedmetadata", syncMetadata);
            element.removeEventListener("resize", syncMetadata);
            for (const name of playbackEvents) element.removeEventListener(name, syncPlayback);
        };
    });

    $effect(() => {
        if (typeof document === "undefined") return;

        document.addEventListener("fullscreenchange", syncFullscreen);
        return () => document.removeEventListener("fullscreenchange", syncFullscreen);
    });

    $effect(() => {
        if (typeof window === "undefined") return;

        // Rotating the device changes the stage aspect, and with it the scale
        // at which the bars disappear. A zoom that was exactly "cover" in
        // portrait is over-cropped in landscape.
        const onResize = () => clampOffsets();

        window.addEventListener("resize", onResize);
        window.addEventListener("orientationchange", onResize);

        return () => {
            window.removeEventListener("resize", onResize);
            window.removeEventListener("orientationchange", onResize);
        };
    });

    $effect(() => {
        // The page behind must not scroll while the overlay is up.
        if (typeof document === "undefined") return;

        if (target) {
            const previous = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = previous;
            };
        }
    });

    onDestroy(() => {
        if (hideTimer) clearTimeout(hideTimer);

        if (typeof document !== "undefined") {
            document.body.style.overflow = "";
        }
    });
</script>

<svelte:window onkeydown={onKeydown} />

{#if target}
    <div
        bind:this={container}
        class="fixed inset-0 z-[100] flex flex-col bg-black"
        role="dialog"
        aria-modal="true"
        aria-label={`Playing ${target.title}`}>
        <!--
            In fullscreen the bar floats over the picture instead of taking a
            row of its own: a `shrink-0` header would keep its height reserved
            even while hidden, leaving a black stripe where video should be.
        -->
        <div
            class="{isFullscreen
                ? 'absolute inset-x-0 top-0 z-10'
                : 'shrink-0'} flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent p-3 transition-opacity duration-300 {controlsVisible
                ? 'opacity-100'
                : 'pointer-events-none opacity-0'}">
            <p class="min-w-0 truncate text-sm font-medium text-white">{target.title}</p>

            <div class="flex shrink-0 items-center gap-1">
                <span class="mr-1 font-mono text-xs text-white/60">{scale.toFixed(1)}x</span>

                <button
                    type="button"
                    onclick={() => zoomBy(1 / 1.3)}
                    aria-label="Zoom out"
                    class="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white">
                    <ZoomOutIcon class="size-5" />
                </button>
                <button
                    type="button"
                    onclick={() => zoomBy(1.3)}
                    aria-label="Zoom in"
                    class="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white">
                    <ZoomInIcon class="size-5" />
                </button>
                <button
                    type="button"
                    onclick={toggleFullscreen}
                    aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                    class="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white">
                    {#if isFullscreen}
                        <MinimizeIcon class="size-5" />
                    {:else}
                        <MaximizeIcon class="size-5" />
                    {/if}
                </button>
                <button
                    type="button"
                    onclick={close}
                    aria-label="Close player"
                    class="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white">
                    <XIcon class="size-5" />
                </button>
            </div>
        </div>

        <!--
            touch-action:none is what makes pinch reach us at all: without it
            the browser claims the gesture for page zoom and no pointer events
            are delivered.
        -->
        <div
            bind:this={stage}
            class="relative flex-1 touch-none overflow-hidden"
            role="application"
            aria-label="Video: swipe across to seek, pinch with two fingers to zoom and pan"
            onpointerdown={onPointerDown}
            onpointermove={onPointerMove}
            onpointerup={onPointerUp}
            onpointercancel={endPointer}
            onpointerleave={endPointer}
            onwheel={onWheel}
            ondblclick={(e) => onDoubleToggle(e.clientX, e.clientY)}>
            <div
                class="h-full w-full origin-center"
                style="transform: translate({offsetX}px, {offsetY}px) scale({scale}); transition: {panStart ||
                pinchStartDistance
                    ? 'none'
                    : 'transform 120ms ease-out'};">
                <!--
                    Keyed so switching titles remounts the player: the element
                    is reused across targets, and a stale src would otherwise
                    keep playing under the new title.
                -->
                {#key target.kind === "library" ? `item-${target.itemId}` : target.src}
                    {#if target.kind === "library"}
                        <VideoPlayer
                            itemId={target.itemId}
                            bind:element={video}
                            bind:duration={probedDuration}
                            class="h-full w-full" />
                    {:else}
                        <VideoPlayer
                            src={target.src}
                            mimeType={target.mimeType}
                            poster={target.poster}
                            bind:element={video}
                            class="h-full w-full" />
                    {/if}
                {/key}
            </div>

            {#if seekPreview}
                <!--
                    The readout is the whole feedback loop for a momentum swipe:
                    without it the viewer is guessing how far a flick went.
                -->
                <div
                    class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
                    <div
                        class="rounded-2xl bg-black/70 px-5 py-3 text-center backdrop-blur-md">
                        <p class="font-mono text-3xl font-semibold text-white tabular-nums">
                            {seekPreview.offset}
                        </p>
                        <p class="mt-1 font-mono text-sm text-white/70 tabular-nums">
                            {seekPreview.target}
                        </p>
                    </div>
                </div>
            {/if}

            <!--
                Our own control bar, because the browser's carries a fullscreen
                button that fullscreens the *video element*, and Android
                presents that with a zoom-to-fill the page cannot override --
                which is what was cropping the frame.
            -->
            <div
                class="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-4 pt-8 pb-4 transition-opacity duration-300 {controlsVisible
                    ? 'opacity-100'
                    : 'pointer-events-none opacity-0'}">
                {#if scale > MIN_SCALE}
                    <button
                        type="button"
                        onclick={reset}
                        class="self-center rounded-full bg-white/10 px-3 py-1 text-xs text-white backdrop-blur">
                        Reset zoom
                    </button>
                {/if}

                <!-- Scrubber -->
                <div
                    role="slider"
                    tabindex="0"
                    aria-label="Seek"
                    aria-valuemin={0}
                    aria-valuemax={Math.round(duration)}
                    aria-valuenow={Math.round(currentTime)}
                    aria-valuetext={formatTime(currentTime)}
                    class="group relative h-6 cursor-pointer touch-none"
                    onpointerdown={(e) => {
                        scrubbing = true;
                        e.currentTarget.setPointerCapture(e.pointerId);
                        scrubTo(e, e.currentTarget);
                    }}
                    onpointermove={(e) => {
                        if (scrubbing) scrubTo(e, e.currentTarget);
                    }}
                    onpointerup={(e) => {
                        scrubbing = false;
                        e.currentTarget.releasePointerCapture(e.pointerId);
                    }}
                    onpointercancel={() => (scrubbing = false)}
                    onkeydown={(e) => {
                        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                        e.preventDefault();
                        if (!video) return;
                        video.currentTime = clampTime(
                            video.currentTime + (e.key === "ArrowRight" ? 10 : -10),
                            video.duration
                        );
                    }}>
                    <div class="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/20">
                        <div
                            class="absolute inset-y-0 left-0 rounded-full bg-white/25"
                            style="width: {duration ? (buffered / duration) * 100 : 0}%">
                        </div>
                        <div
                            class="bg-primary absolute inset-y-0 left-0 rounded-full"
                            style="width: {duration ? (currentTime / duration) * 100 : 0}%">
                        </div>
                    </div>
                    <div
                        class="bg-primary absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow transition-transform group-hover:scale-125"
                        style="left: {duration ? (currentTime / duration) * 100 : 0}%">
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <button
                        type="button"
                        onclick={togglePlay}
                        aria-label={paused ? "Play" : "Pause"}
                        class="rounded-lg p-1.5 text-white/90 hover:bg-white/10 hover:text-white">
                        {#if paused}
                            <PlayIcon class="size-6" />
                        {:else}
                            <PauseIcon class="size-6" />
                        {/if}
                    </button>


                    <button
                        type="button"
                        onclick={openInExternal}
                        title="Open in external player"
                        aria-label="Open in external player"
                        class="rounded-lg p-1.5 text-white/90 hover:bg-white/10 hover:text-white"
                        class:hidden={!canOpenExternal}>
                        <ShareIcon class="size-5" />
                    </button>

                    <button
                        type="button"
                        onclick={toggleMute}
                        aria-label={muted ? "Unmute" : "Mute"}
                        class="rounded-lg p-1.5 text-white/90 hover:bg-white/10 hover:text-white">
                        {#if muted}
                            <VolumeXIcon class="size-5" />
                        {:else}
                            <Volume2Icon class="size-5" />
                        {/if}
                    </button>

                    <p class="font-mono text-xs text-white/70 tabular-nums">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </p>
                </div>
            </div>
        </div>
    </div>
{/if}
