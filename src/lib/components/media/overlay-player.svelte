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
    import { toGuid } from "$lib/utils/jellyfin-ids";
    import { player } from "$lib/stores/player.svelte";
    import { toast } from "svelte-sonner";
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
    import BookmarkIcon from "@lucide/svelte/icons/bookmark";
    import { formatBytes } from "$lib/helpers";
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
    // Library-item equivalents of the direct player's liveResolution/liveSize,
    // filled in by the same playback_info probe that supplies probedDuration.
    let probedResolution = $state<string | undefined>(undefined);
    let probedFileSize = $state<number | undefined>(undefined);
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

    /**
     * Seek to the position the store restored, once there is a timeline to
     * seek within. Consumed rather than re-applied: the point is only good
     * for the load it came back on, and leaving it set would drag the viewer
     * back there after every later seek of their own.
     */
    function applyResume() {
        const at = player.resumeAt;
        if (!video || at === null) return;

        player.resumeAt = null;

        if (!Number.isFinite(at) || at <= 0) return;

        try {
            video.currentTime = at;
        } catch {
            // Not seekable yet -- the position is lost, not the playback.
        }
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

        // Keep the resume point current, so an activity restart (a foldable
        // being opened mid-playback) comes back to the same second.
        if (video.currentTime > 0) player.remember(video.currentTime);

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

        const leaving = !!document.fullscreenElement || isFullscreen;

        /*
            Inside the Jellyfin WebView the status bar is OUTSIDE the page's
            viewport, so requestFullscreen() cannot touch it -- the video
            expands to fill the WebView and the system bar stays visible over
            it. Only the native activity can hide it. Ask it first, then still
            run the web path below so the page's own layout switches to its
            fullscreen arrangement either way.
        */
        if (leaving) window.RivenNative?.disableFullscreen?.();
        else window.RivenNative?.enableFullscreen?.();

        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            } else {
                await container.requestFullscreen();
            }
        } catch {
            // Safari on iPhone refuses fullscreen on non-video elements, and
            // the WebView may refuse it too -- in the latter case the native
            // call above has already done the real work, so track the state
            // ourselves rather than leaving the UI out of step with it.
            isFullscreen = !leaving;
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
        // Unconditional: the native activity may be fullscreen (and locked to
        // landscape) even when document.fullscreenElement is null, because
        // the WebView can refuse the web request while the native side still
        // took effect. Leaving that on would strand the whole app in
        // landscape with no status bar after the player closes.
        window.RivenNative?.disableFullscreen?.();
        reset();
        player.close();
    }

    /*
        The Android back gesture, while a video is open.

        The multiplexer answers the client's back press by dispatching a
        cancelable "mux:back" (see its inject.ts): the client evaluates
        window.NavigationHelper.goBack() in the page, and without a handler
        that walks history and navigates the whole app away from underneath
        someone who only meant to close the video. Claiming the event here
        makes back mean "close this player", which is what it means in every
        other video app.
    */
    $effect(() => {
        if (!target) return;

        const onBack = (event: Event) => {
            event.preventDefault();
            close();
        };

        window.addEventListener("mux:back", onBack);

        return () => window.removeEventListener("mux:back", onBack);
    });

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
    /*
        Only when a shell bridge is actually there to hand a URL to. In a
        plain browser there is nothing to open with, and a control that
        cannot do anything is worse than no control -- which is what this
        was, since it rendered whenever something was playing.

        Resolved on mount rather than inline: the bridge is injected by a
        deferred script, so it can be absent for the first render even inside
        the shell.
    */
    let canOpenExternal = $state(false);

    /*
        Re-checked every time the player opens, not once on mount.

        This component mounts with the protected layout, which can happen
        BEFORE the bridge exists: the shell script is injected with `defer`,
        so it runs after parsing, and hydration can win that race. Checking
        once at mount latched this to false and the button never appeared --
        reported as "the open in external app button is missing", and it was,
        permanently, for the whole session.

        By the time a video is actually opened the bundle has long since run,
        so keying this on `target` is both correct and the latest possible
        moment to ask.
    */
    $effect(() => {
        if (!target) return;

        canOpenExternal = !!window.RivenNative?.openExternal;
    });

    /**
     * Hand-off succeeded: stop here and get out of the way.
     *
     * The video keeps playing otherwise -- two players running the same
     * scene, one of them behind an overlay the viewer has to dismiss by
     * hand, both pulling the same stream. The pause is explicit rather than
     * left to the element being torn down, because it has to take effect
     * before the external app starts its own buffering, not whenever Svelte
     * gets around to unmounting.
     */
    function handedOff() {
        try {
            video?.pause();
        } catch {
            /* Already gone; closing is what matters. */
        }

        close();
    }

    let openingExternal = $state(false);

    /**
     * Wait for evidence that another app actually came to the front.
     *
     * Needed because none of the native entry points can tell us. Both go
     * through ExternalPlayer.initPlayer(), which resolves the item through
     * PlaybackInfo on a coroutine and reports every failure -- bad play
     * options, network failure, unsupported content -- with an Android Toast
     * and no callback at all (ExternalPlayer.kt). A JS return value therefore
     * says nothing about whether a player opened.
     *
     * What IS observable is this page losing the foreground. If a chooser or
     * a player appears, the WebView is hidden within a moment; if
     * initPlayer() failed, it never is.
     */
    function awaitForeground(timeoutMs = 5000): Promise<boolean> {
        return new Promise((resolve) => {
            if (typeof document === "undefined") return resolve(false);
            if (document.hidden) return resolve(true);

            let settled = false;

            const finish = (ok: boolean) => {
                if (settled) return;
                settled = true;
                document.removeEventListener("visibilitychange", onVisibility);
                window.removeEventListener("riven:external-player", onReport);
                clearTimeout(timer);
                resolve(ok);
            };

            const onVisibility = () => {
                if (document.hidden) finish(true);
            };
            // The external player reporting back is proof it ran, and arrives
            // sooner than a visibility change on some shells.
            const onReport = () => finish(true);
            const timer = setTimeout(() => finish(false), timeoutMs);

            document.addEventListener("visibilitychange", onVisibility);
            window.addEventListener("riven:external-player", onReport);
        });
    }

    /**
     * Try one native hand-off, and close ONLY if it really happened.
     *
     * The player used to close the instant the bridge existed, which is why
     * tapping this reportedly "just closed the player without doing
     * anything": every failure downstream of that -- no credentials, a
     * PlaybackInfo that 404s, a dead provider link -- happened after the
     * overlay was already gone, with nothing on screen to say so.
     */
    async function bridgeHandoff(method: "openInExternalPlayer" | "playDirect", itemId: string) {
        const bridge = window.RivenNative?.[method];

        if (!bridge) return false;

        // Paused before the wait, not after: two players pulling the same
        // stream is the thing to avoid, and the wait is seconds long.
        try {
            video?.pause();
        } catch {
            /* Nothing to pause. */
        }

        /*
            Three outcomes, not two.

            "declined" is the bridge saying it is not the right route at all
            -- playDirect() when no native player is the default -- and the
            caller should simply try the next one. "failed" is the bridge
            taking the call and then not being able to complete it, which is
            the credential exchange going wrong and worth telling someone
            about. Collapsing the two meant either a silent failure or a
            spurious error on every ordinary fall-through.
        */
        const outcome = await new Promise<"declined" | "failed" | "accepted">((resolve) => {
            let called: boolean;

            try {
                called = !!bridge.call(window.RivenNative, itemId, (ok: boolean) =>
                    resolve(ok ? "accepted" : "failed")
                );
            } catch {
                called = false;
            }

            if (!called) resolve("declined");
        });

        if (outcome === "declined") return false;

        if (outcome === "failed") {
            toast.error("Could not authenticate the hand-off to an external player");
            return true;
        }

        if (await awaitForeground()) {
            handedOff();
            return true;
        }

        // The bridge took it and nothing opened. Stay put and say so -- the
        // video is paused where it was, so play resumes it.
        toast.error("The external player did not open. Check the client's player settings.");

        return true;
    }

    async function openInExternal() {
        if (!target || openingExternal) return;

        openingExternal = true;

        try {
            let url: string | null = null;
            /*
                The Jellyfin item id to hand the native player. A library item
                already has one; a direct-scrape video has one minted for it.
                Either way this is the path that produces a chooser -- see the
                note below on why openUrl() cannot.
            */
            let itemId: string | null = null;

            if (target.kind === "direct") {
                /*
                    NOT the in-page player's own URL. That one is
                    cookie-authenticated and has no file extension, so another
                    app cannot fetch it and Android cannot tell it is a video
                    -- between them, exactly why this used to open a download
                    in a browser instead of a player chooser. Mint one that
                    carries its own token and ends in .mp4.
                */
                const query = new URLSearchParams({
                    site: target.site ?? "",
                    videoId: target.videoId ?? "",
                    title: target.title ?? "video"
                });
                const response = await fetch(`/api/direct/external_url?${query}`);

                if (response.ok) {
                    const payload = await response.json();
                    url = payload.url ?? null;
                    itemId = payload.itemId ?? null;
                }
            } else {
                /*
                    A library item already HAS a Jellyfin id -- the same one
                    tapping Play hands to the native player -- so use it. This
                    branch used to set only `url`, which meant it always fell
                    through to openUrl() below and the video opened in a
                    BROWSER instead of a player chooser. Reported exactly that
                    way, and only for library items: the direct-scrape branch
                    above has minted an id since it was written.
                */
                itemId = toGuid(target.itemId);

                /*
                    Still fetched, as the fallback for a shell with no player
                    bridge: the item's own player URL is cookie-authenticated
                    and useless to another app, so ask for one carrying a
                    play-session capability token instead.
                */
                const response = await fetch(`/api/stream/${target.itemId}/external_url`);

                if (response.ok) url = (await response.json()).url ?? null;
            }


            /*
                Deliberately NOT gated on externalPlayerSelected(). That
                setting picks the DEFAULT for tapping Play; this button is an
                explicit "open this one in something else right now", and
                gating it meant the button did nothing whenever the default
                was the web player -- which is exactly when someone reaches
                for it.
            */
            /*
                By ID first, URL only as a fallback.

                openUrl() cannot produce a media-player chooser at all: it
                fires Intent(ACTION_VIEW, uri) with no MIME type, so Android
                resolves the http URL by scheme and hands it to a browser --
                reported exactly that way, as the video opening in the browser
                with no chooser. playDirect() goes through
                ExternalPlayer.initPlayer(), which sets the "video/*" type
                that makes the chooser appear, and it addresses videos by id.

                The URL path stays for plain browsers and for any shell that
                exposes openUrl but no player bridge, where it is still the
                best available behaviour.
            */
            /*
                The external hand-off first, and NOT gated on the client's
                default player: ExternalPlayer.initPlayer() has no isEnabled()
                check, so it works even when the web player is selected --
                which is the only time this button is on screen at all.
            */
            if (itemId && (await bridgeHandoff("openInExternalPlayer", itemId))) return;

            // Then whichever native player is the default, for a shell that
            // has a player bridge but no external one.
            if (itemId && (await bridgeHandoff("playDirect", itemId))) return;

            if (!url) {
                toast.error("Could not build a link for an external player");
                return;
            }

            if (!window.RivenNative?.openExternal(url)) {
                toast.error("No app available to open this video");
                return;
            }

            handedOff();
        } finally {
            openingExternal = false;
        }
    }

    /**
     * Bookmarking and resolution/size, for a direct-scrape video only --
     * a library item is already saved by definition (it is in the library),
     * and the description area shows the real ffprobe'd values for those
     * already, from `video-player.svelte`'s own playback-info fetch.
     */
    let bookmarked = $state(false);
    let bookmarkBusy = $state(false);
    let liveResolution = $state<string | null>(null);
    let liveSize = $state<number | null>(null);
    let metaLoading = $state(false);

    const directTarget = $derived(target?.kind === "direct" ? target : null);

    /*
        One pair of values for the header, whichever kind of source is
        playing. A direct video prefers the freshly resolved numbers over
        whatever the search result carried; a library item has only the
        ffprobe ones.
    */
    const shownResolution = $derived(
        directTarget ? (liveResolution ?? directTarget.resolution) : probedResolution
    );
    const shownSize = $derived(
        directTarget ? (liveSize ?? directTarget.size) : probedFileSize
    );
    const canBookmark = $derived(!!directTarget?.site && !!directTarget?.videoId);

    async function checkBookmarked() {
        if (!directTarget?.site || !directTarget?.videoId || !directTarget?.contextTitle) {
            bookmarked = false;
            return;
        }
        try {
            const response = await fetch(
                `/api/bookmarks?contextTitle=${encodeURIComponent(directTarget.contextTitle)}`
            );
            if (!response.ok) return;
            const payload = await response.json();
            const bookmarks: { site: string; videoId: string }[] = payload.bookmarks ?? [];
            bookmarked = bookmarks.some(
                (b) => b.site === directTarget.site && b.videoId === directTarget.videoId
            );
        } catch {
            // Not knowing is not worth failing over -- the toggle button
            // just falls back to "not bookmarked" and the user can retry.
        }
    }

    async function toggleBookmark() {
        if (!directTarget?.site || !directTarget?.videoId) return;
        bookmarkBusy = true;

        try {
            if (bookmarked) {
                const response = await fetch(
                    `/api/bookmarks?site=${encodeURIComponent(directTarget.site)}&videoId=${encodeURIComponent(directTarget.videoId)}`,
                    { method: "DELETE" }
                );
                if (response.ok) bookmarked = false;
            } else {
                const response = await fetch("/api/bookmarks", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        site: directTarget.site,
                        videoId: directTarget.videoId,
                        contextTitle: directTarget.contextTitle ?? directTarget.title,
                        title: directTarget.title,
                        pageUrl: directTarget.src,
                        thumbnail: directTarget.poster ?? null,
                        duration: directTarget.duration ?? null,
                        resolution: liveResolution ?? directTarget.resolution ?? null,
                        size: liveSize ?? directTarget.size ?? null
                    })
                });
                if (response.ok) bookmarked = true;
            }
        } finally {
            bookmarkBusy = false;
        }
    }

    /**
     * Non-blocking: playback already started by the time this runs (the
     * video element has its src and is decoding), so this only ever fills in
     * the description a moment later. Skipped entirely when the search
     * result already carried real numbers -- most sites do not, but the ones
     * that do should not cost a redundant request for something already
     * known.
     */
    async function fetchLiveMeta() {
        if (!directTarget?.site || !directTarget?.videoId) return;
        if (directTarget.resolution && directTarget.size) return;

        metaLoading = true;
        try {
            const response = await fetch(
                `/api/direct/meta?site=${encodeURIComponent(directTarget.site)}&videoId=${encodeURIComponent(directTarget.videoId)}`
            );
            if (!response.ok) return;
            const data = await response.json();
            liveResolution = data.resolution ?? null;
            liveSize = data.size ?? null;
        } catch {
            // The player itself is already running -- a failed enrichment
            // fetch just means the description stays blank, not an error.
        } finally {
            metaLoading = false;
        }
    }

    $effect(() => {
        liveResolution = null;
        liveSize = null;
        bookmarked = false;

        if (directTarget) {
            checkBookmarked();
            fetchLiveMeta();
        }
    });

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
        element.addEventListener("loadedmetadata", applyResume);
        for (const name of playbackEvents) element.addEventListener(name, syncPlayback);

        syncMetadata();
        syncPlayback();

        return () => {
            element.removeEventListener("loadedmetadata", syncMetadata);
            element.removeEventListener("resize", syncMetadata);
            element.removeEventListener("loadedmetadata", applyResume);
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
            <div class="min-w-0">
                <p class="truncate text-sm font-medium text-white">{target.title}</p>
                <!--
                    Resolution and size, for both kinds of source.

                    A library file gets them from the ffprobe playback_info
                    call the player already makes (height, plus the recorded
                    download size, which the probe itself cannot know -- it
                    reads stream metadata over the network, never the whole
                    file). A direct-scrape video gets them from the search
                    result or the on-demand resolve. Different origins, same
                    two facts, so they are rendered by one block rather than
                    two that could drift apart.
                -->
                {#if directTarget && metaLoading && !shownResolution && !shownSize}
                    <p class="text-xs text-white/50">Fetching quality&hellip;</p>
                {:else if shownResolution || shownSize}
                    <p class="font-mono text-xs text-white/60">
                        {[shownResolution, shownSize ? formatBytes(shownSize) : null]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>
                {/if}
            </div>

            <div class="flex shrink-0 items-center gap-1">
                <span class="mr-1 font-mono text-xs text-white/60">{scale.toFixed(1)}x</span>

                {#if canBookmark}
                    <button
                        type="button"
                        onclick={toggleBookmark}
                        disabled={bookmarkBusy}
                        aria-label={bookmarked ? "Remove bookmark" : "Bookmark this video"}
                        class="rounded-lg p-2 hover:bg-white/10 {bookmarked
                            ? 'text-amber-400 hover:text-amber-300'
                            : 'text-white/80 hover:text-white'}">
                        <BookmarkIcon class={bookmarked ? "size-5 fill-current" : "size-5"} />
                    </button>
                {/if}

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
                            bind:resolution={probedResolution}
                            bind:fileSize={probedFileSize}
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
