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
     *   - drag (1 touch/mouse): pans, but only while zoomed in, otherwise it
     *                          would swallow taps meant for the controls
     *   - double tap/click   : toggles between fit and fill
     *   - wheel              : desktop zoom, anchored on the pointer
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
        MAX_SCALE,
        MIN_SCALE,
        clampTransform,
        fillScale,
        midpoint,
        pinchDistance,
        zoomAt as computeZoom,
        type Transform,
        type Viewport
    } from "$lib/utils/zoom";

    let container = $state<HTMLDivElement | undefined>();
    let stage = $state<HTMLDivElement | undefined>();

    let scale = $state(1);
    let offsetX = $state(0);
    let offsetY = $state(0);
    let isFullscreen = $state(false);

    // Gesture bookkeeping. `pinchStartDistance` and `panStart` are reactive
    // because the transform reads them to disable its transition mid-gesture --
    // an eased transform would lag the fingers.
    let pointers = new Map<number, { x: number; y: number }>();
    let pinchStartDistance = $state(0);
    let panStart = $state<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
    let pinchStartScale = 0;
    let lastTap = 0;

    const target = $derived(player.current);

    /** Stage geometry, read fresh: the viewport changes on rotate/fullscreen. */
    function viewport(): Viewport | null {
        if (!stage) return null;

        const rect = stage.getBoundingClientRect();
        return { width: rect.width, height: rect.height, left: rect.left, top: rect.top };
    }

    function current(): Transform {
        return { scale, offsetX, offsetY };
    }

    function apply(next: Transform) {
        scale = next.scale;
        offsetX = next.offsetX;
        offsetY = next.offsetY;
    }

    function clampOffsets() {
        const view = viewport();
        if (view) apply(clampTransform(view, current()));
    }

    function zoomAt(nextScale: number, clientX: number, clientY: number) {
        const view = viewport();
        if (view) apply(computeZoom(view, current(), nextScale, clientX, clientY));
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

    function onPointerDown(event: PointerEvent) {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            pinchStartDistance = pinchDistance(a, b);
            pinchStartScale = scale;
            panStart = null;
        } else if (pointers.size === 1 && scale > MIN_SCALE) {
            panStart = { x: event.clientX, y: event.clientY, offsetX, offsetY };
        }
    }

    function onPointerMove(event: PointerEvent) {
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
        }
    }

    function endPointer(event: PointerEvent) {
        pointers.delete(event.pointerId);

        if (pointers.size < 2) pinchStartDistance = 0;
        if (pointers.size === 0) panStart = null;
    }

    function onDoubleToggle(clientX: number, clientY: number) {
        if (scale > MIN_SCALE) {
            reset();
            return;
        }

        // "Fill the screen": enough zoom that the letterboxing is gone.
        const view = viewport();
        if (!view) return;

        const video = stage?.querySelector("video");

        zoomAt(fillScale(view, video?.videoWidth ?? 0, video?.videoHeight ?? 0), clientX, clientY);
    }

    function onWheel(event: WheelEvent) {
        if (!event.ctrlKey && scale === MIN_SCALE) return;

        event.preventDefault();
        zoomAt(scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15), event.clientX, event.clientY);
    }

    function onPointerUp(event: PointerEvent) {
        const wasPinching = pointers.size === 2;
        endPointer(event);

        if (wasPinching || event.pointerType === "mouse") return;

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
        if (target) reset();
    });

    $effect(() => {
        if (typeof document === "undefined") return;

        document.addEventListener("fullscreenchange", syncFullscreen);
        return () => document.removeEventListener("fullscreenchange", syncFullscreen);
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
        <div
            class="flex shrink-0 items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent p-3">
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
                    <VideoPlayer itemId={target.itemId} class="h-full w-full" />
                {/key}
            </div>

            {#if scale > MIN_SCALE}
                <button
                    type="button"
                    onclick={reset}
                    class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur">
                    Reset zoom
                </button>
            {/if}
        </div>
    </div>
{/if}
