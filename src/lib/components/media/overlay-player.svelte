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
     *   - pinch (2 touches)  : the primary mobile gesture, anchored on the
     *                          midpoint between the fingers so the content
     *                          under them stays put
     *   - drag while zoomed  : pans the cropped picture
     *   - horizontal swipe   : seeks, at a rate that follows the swipe's own
     *                          momentum, so one gesture covers both a nudge
     *                          and a jump across the film. Fullscreen only,
     *                          and only at fit, where there is nothing to pan
     *   - double tap/click   : toggles between fit and fill
     *   - wheel              : desktop zoom, anchored on the pointer
     *
     * Zoom runs from fit (the whole frame, letterboxed) to cover (the bars
     * exactly gone) and stops there. Zooming past cover only discards picture.
     */
    import { onDestroy } from "svelte";
    import { player } from "$lib/stores/player.svelte";
    import VideoPlayer from "./video-player.svelte";
    import XIcon from "@lucide/svelte/icons/x";
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
        zoomAt as computeZoom,
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

    // Gesture bookkeeping. `pinchStartDistance` and `panStart` are reactive
    // because the transform reads them to disable its transition mid-gesture --
    // an eased transform would lag the fingers.
    let pointers = new Map<number, { x: number; y: number }>();
    let pinchStartDistance = $state(0);
    let panStart = $state<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
    let pinchStartScale = 0;
    let lastTap = 0;

    const target = $derived(player.current);

    /** How long the chrome stays up after the last interaction, in fullscreen. */
    const CONTROLS_HIDE_MS = 3000;

    /** Height reserved for the UA's own control bar at the bottom of the stage. */
    const NATIVE_CONTROLS_PX = 88;

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

    function onPointerDown(event: PointerEvent) {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            pinchStartDistance = pinchDistance(a, b);
            pinchStartScale = scale;
            panStart = null;
        } else if (pointers.size === 1 && scale > MIN_SCALE) {
            panStart = { x: event.clientX, y: event.clientY, offsetX, offsetY };
        } else if (pointers.size === 1 && canSeek() && !onNativeControls(event)) {
            // At fit there is nothing to pan, so a single-finger drag is free
            // to mean something else.
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

        if (pointers.size === 2 && pinchStartDistance > 0) {
            const [a, b] = [...pointers.values()];
            const centre = midpoint(a, b);
            const ratio = pinchDistance(a, b) / pinchStartDistance;

            // Prevent the browser treating this as a page pinch-zoom.
            event.preventDefault();
            zoomAt(pinchStartScale * ratio, centre.x, centre.y);
            return;
        }

        if (panStart && pointers.size === 1) {
            event.preventDefault();
            offsetX = panStart.offsetX + (event.clientX - panStart.x);
            offsetY = panStart.offsetY + (event.clientY - panStart.y);
            clampOffsets();
            return;
        }

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

        if (pointers.size < 2) pinchStartDistance = 0;
        if (pointers.size === 0) {
            panStart = null;
            commitSeek();
        }
    }

    /**
     * Is this pointer landing on the browser's own control bar?
     *
     * The native scrubber is also dragged horizontally, so without this a drag
     * on it would scrub *and* run this component's seek, fighting each other.
     * The bar is drawn by the UA and cannot be hit-tested, so its height is
     * approximated generously -- over-reserving costs a strip of the picture
     * for gestures, under-reserving costs correctness.
     */
    function onNativeControls(event: PointerEvent): boolean {
        if (!controlsVisible) return false;

        const view = viewport();
        if (!view) return false;

        return event.clientY > view.top + view.height - NATIVE_CONTROLS_PX;
    }

    /** True where a horizontal drag should scrub rather than do nothing. */
    function canSeek(): boolean {
        return isFullscreen && scale <= MIN_SCALE && !!video && Number.isFinite(video.duration);
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
    }

    $effect(() => {
        // Reset zoom whenever a different title is opened, so one title's zoom
        // does not carry into the next.
        if (target) {
            reset();
            videoWidth = 0;
            videoHeight = 0;
            showControls();
        }
    });

    $effect(() => {
        if (!video) return;

        const element = video;
        element.addEventListener("loadedmetadata", syncMetadata);
        element.addEventListener("resize", syncMetadata);
        syncMetadata();

        return () => {
            element.removeEventListener("loadedmetadata", syncMetadata);
            element.removeEventListener("resize", syncMetadata);
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
            aria-label="Video, pinch or scroll to zoom"
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
                {#key target.itemId}
                    <VideoPlayer
                        itemId={target.itemId}
                        bind:element={video}
                        controls={controlsVisible}
                        class="h-full w-full" />
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

            {#if scale > MIN_SCALE && controlsVisible}
                <button
                    type="button"
                    onclick={reset}
                    class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur transition-opacity duration-300">
                    Reset zoom
                </button>
            {/if}
        </div>
    </div>
{/if}
