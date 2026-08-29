<script lang="ts">
    /**
     * Chooses how to play a file, based on what the file actually contains.
     *
     * The previous implementation asked the *browser* whether it could decode
     * HEVC and never looked at the file. Firefox supports no HEVC, so Firefox
     * transcoded everything -- including the plain H.264/AAC MP4s that make up
     * this library and that it plays natively. That is the "transcode error".
     *
     * Now the backend probes the file and reports its real codecs; the browser
     * is asked about *those*, via canPlayType. Three outcomes:
     *
     *   direct    -- stream the file as-is, full native seeking
     *   remux     -- keep the video, rebuild audio/container (cheap)
     *   transcode -- re-encode via HLS (last resort, expensive)
     */
    import { onMount, onDestroy } from "svelte";
    import { resumeTarget } from "$lib/utils/playback";
    import Hls from "hls.js";
    import { toGuid } from "$lib/utils/jellyfin-ids";

    interface VideoPlayerProps {
        /**
         * Library item to play. Omitted for a direct-site video, which has no
         * item id because nothing was ever downloaded for it.
         */
        itemId?: number;
        /**
         * A ready-made URL to play instead of a library item. When set, the
         * codec negotiation below is skipped entirely: the backend has already
         * resolved and is proxying the file, and there is no remux or
         * transcode path to fall back to.
         */
        src?: string;
        /** What `src` serves. An HLS playlist needs hls.js, an MP4 does not. */
        mimeType?: string;
        poster?: string;
        class?: string;
        /**
         * Exposed so the overlay can drive seeking and read the frame size.
         * The overlay owns the gestures; this component owns the element.
         */
        element?: HTMLVideoElement;
        /**
         * Whether the browser's own control bar is shown.
         *
         * The overlay passes false and draws its own. The native bar carries a
         * fullscreen button that fullscreens the *video element*, and Android
         * browsers present that with their own zoom-to-fill, cropping the
         * frame -- which no page CSS can override. Not offering the button is
         * the only reliable way to keep fullscreen on the overlay's terms.
         */
        controls?: boolean;
        /**
         * The file's real duration, from ffprobe -- undefined until
         * playback_info answers, or if it never got a usable probe.
         *
         * `video.duration` is not trustworthy on its own: for a file whose
         * moov atom sits at the end (common for anything not remuxed with
         * `+faststart`, which includes plain Bluray remuxes), the browser
         * cannot see the real duration until that atom has downloaded --
         * until then it estimates from whatever bytes have buffered, and
         * that estimate can be wildly short or long, and can also keep
         * changing as more buffers in. Callers should prefer this value over
         * the element's own `duration` whenever it is set.
         */
        duration?: number;
        /**
         * The file's real height as "1080p", and its size in bytes, both from
         * the same playback_info probe as `duration`. Reported so the overlay
         * can describe a library file exactly the way it already describes a
         * direct-scrape one -- undefined until that call answers, and for a
         * direct video, which has no library item to probe.
         */
        resolution?: string;
        fileSize?: number;
    }

    interface PlaybackInfo {
        mode: "direct" | "remux" | "transcode";
        mime_type: string | null;
        reason: string;
        file_size: number | null;
        probe: {
            duration: number;
            video_codec: string | null;
            audio_codec: string | null;
            container: string | null;
            width: number | null;
            height: number | null;
        };
    }

    let {
        itemId,
        src,
        mimeType = "video/mp4",
        poster,
        class: className = "",
        element = $bindable(),
        controls = false,
        duration = $bindable(),
        resolution = $bindable(),
        fileSize = $bindable()
    }: VideoPlayerProps = $props();

    let videoElement: HTMLVideoElement | undefined = $state();

    // Publish the element upwards as soon as it exists.
    $effect(() => {
        element = videoElement;
    });
    let hls: Hls | undefined;
    let error = $state<string | null>(null);
    let mode = $state<string | null>(null);
    let loading = $state(true);

    // Derived, not const: the overlay player reuses one instance across
    // titles, so these have to follow the id rather than freeze on first mount.
    const directUrl = $derived(`/api/stream/${itemId}`);
    const remuxUrl = $derived(`/api/stream/${itemId}/remux`);
    const hlsUrl = $derived(`/api/stream/${itemId}/hls/index.m3u8`);

    /** Can this browser decode what the backend says is in the file? */
    function browserCanPlay(mimeType: string | null): boolean {
        if (!mimeType || typeof document === "undefined") return false;

        const probe = document.createElement("video");
        // "probably" and "maybe" both mean "try it"; "" means it cannot.
        return probe.canPlayType(mimeType) !== "";
    }

    /**
     * Start playback explicitly, rather than trusting the `autoplay`
     * attribute.
     *
     * `autoplay` is only reliable when the source is present at parse time.
     * Here it is assigned after an async playback_info round trip, by which
     * point the browser has already decided the element had nothing to play
     * and moved on -- so the overlay opened paused and had to be started by
     * hand.
     *
     * Not a policy violation: opening this player is itself a click, and
     * user activation is document-wide and outlives that async gap. If a
     * browser refuses anyway the overlay's own play button is right there,
     * so a rejection is left alone rather than retried muted -- starting
     * silently would be a worse surprise than starting paused.
     */
    function attemptPlay(): void {
        videoElement?.play().catch(() => {});
    }

    function startDirect() {
        mode = "direct";
        if (videoElement) videoElement.src = directUrl;
    }

    function startRemux() {
        mode = "remux";
        if (videoElement) videoElement.src = remuxUrl;
    }

    function startHls() {
        mode = "transcode";

        // Safari plays HLS natively and does it better than hls.js can.
        if (videoElement?.canPlayType("application/vnd.apple.mpegurl")) {
            videoElement.src = hlsUrl;
            return;
        }

        if (!Hls.isSupported()) {
            error = "This browser cannot play the transcoded stream.";
            return;
        }

        hls = new Hls({
            maxBufferLength: 60,
            maxMaxBufferLength: 120,
            // Segments are produced on demand by a live ffmpeg session, so the
            // first request for one can legitimately take a while. The old
            // defaults gave up long before the transcoder had answered.
            manifestLoadingTimeOut: 30_000,
            fragLoadingTimeOut: 90_000,
            fragLoadingMaxRetry: 4
        });

        hls.loadSource(hlsUrl);
        if (videoElement) hls.attachMedia(videoElement);

        hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;

            // Network and media errors are usually recoverable -- a segment
            // arrived late, or the session restarted after a seek. Only give up
            // once hls.js itself says it cannot continue.
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                hls?.startLoad();
                return;
            }

            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                hls?.recoverMediaError();
                return;
            }

            console.error("HLS fatal error:", data);
            error = "Playback failed while transcoding this file.";
        });
    }

    /** Play a URL the backend has already resolved for us. */
    function startExternal(url: string) {
        if (isHlsPlaylist(mimeType)) {
            mode = "transcode";
            if (videoElement?.canPlayType(mimeType)) {
                videoElement.src = url;
                return;
            }
            if (!Hls.isSupported()) {
                error = "This browser cannot play this stream.";
                return;
            }
            hls = new Hls();
            hls.loadSource(url);
            if (videoElement) hls.attachMedia(videoElement);
            return;
        }

        mode = "external";
        if (videoElement) videoElement.src = url;
    }

    function isHlsPlaylist(type: string): boolean {
        return type.includes("mpegurl") || type.includes("x-mpegURL");
    }

    /**
     * Resume tracking, shared with every Jellyfin client.
     *
     * Both write to the same store (`/api/playback/progress` here,
     * `/Sessions/Playing/*` there), so where you got to follows you between
     * the browser and the TV rather than being per-app.
     *
     * Reported on an interval rather than on `timeupdate`, which fires 4-66
     * times a second and would be a request storm. Also reported once on
     * teardown, so closing the player is recorded even if it happens between
     * ticks -- that is the common case, and the one that matters most.
     */
    const PROGRESS_INTERVAL_MS = 10_000;

    let progressTimer: ReturnType<typeof setInterval> | undefined;
    let resumeApplied = false;

    function reportProgress(): void {
        if (itemId === undefined || !videoElement) return;

        const positionSeconds = videoElement.currentTime;

        if (!Number.isFinite(positionSeconds)) return;

        const durationSeconds = Number.isFinite(videoElement.duration)
            ? videoElement.duration
            : duration;

        // keepalive: this runs during teardown, where a normal fetch is
        // cancelled with the page/component and the last position is lost.
        void fetch("/api/playback/progress", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ itemId, positionSeconds, durationSeconds }),
            keepalive: true
        }).catch(() => {});
    }

    /** Seek to the stored position, once, on the first loadedmetadata. */
    async function applyResume(): Promise<void> {
        if (resumeApplied || itemId === undefined || !videoElement) return;

        resumeApplied = true;

        try {
            const response = await fetch(`/api/playback/progress?itemId=${itemId}`);

            if (!response.ok) return;

            const { positionSeconds } = await response.json();

            const target = resumeTarget(
                positionSeconds,
                Number.isFinite(videoElement.duration) ? videoElement.duration : duration
            );

            if (target !== null) videoElement.currentTime = target;
        } catch {
            // A missing resume point is not worth interrupting playback for.
        }
    }

    function startProgressReporting(): void {
        clearInterval(progressTimer);
        progressTimer = setInterval(reportProgress, PROGRESS_INTERVAL_MS);
    }

    onMount(async () => {
        // Running inside the Jellyfin WebView shell (official Android app,
        // LG webOS) with its native player available: hand off to ExoPlayer
        // instead of setting up this in-page <video> element. It takes over
        // as a native overlay outside this component's DOM, resolving
        // playback itself via /Items/{id}/PlaybackInfo + /Videos/{id}/stream
        // -- see lib/server/jellyfin/bundle.ts for the bridge.
        if (itemId && window.RivenNative?.available()) {
            loading = false;
            window.RivenNative.play(toGuid(itemId));
            return;
        }

        if (src) {
            // No library item behind this, so no probe to trust either --
            // fall back to whatever the element itself reports.
            duration = undefined;
            startExternal(src);
            loading = false;
            return;
        }

        try {
            const response = await fetch(`/api/stream/${itemId}/playback_info`);

            if (!response.ok) throw new Error(`playback_info returned ${response.status}`);

            const info: PlaybackInfo = await response.json();
            console.log(`Playback mode: ${info.mode} -- ${info.reason}`);

            // A duration of 0 means the probe failed rather than that the
            // file is instant; only trust a positive value.
            duration = info.probe.duration > 0 ? info.probe.duration : undefined;

            // Reported the same way the direct-scrape player reports them, so
            // one overlay can show both kinds of source identically. Height
            // rather than width because that is what "1080p" names, and the
            // same file is 1920x1080 or 1440x1080 depending on aspect.
            resolution = info.probe.height ? `${info.probe.height}p` : undefined;
            fileSize = info.file_size ?? undefined;

            // The backend recommends; the browser decides, because only it
            // knows what it can actually decode.
            if (info.mode === "direct" && browserCanPlay(info.mime_type)) {
                startDirect();
            } else if (info.mode === "direct") {
                // Backend thought it was fine, this browser disagrees.
                console.log("Browser rejected the file's codecs; transcoding instead.");
                startHls();
            } else if (info.mode === "remux") {
                startRemux();
            } else {
                startHls();
            }
        } catch (e) {
            // Probing is an optimisation, not a requirement. If it fails, try
            // the cheap path and let the media element report a real error.
            console.error("Could not determine playback mode:", e);
            duration = undefined;
            startDirect();
        } finally {
            loading = false;
        }
    });

    onDestroy(() => {
        // Before tearing anything down: this is the position that actually
        // matters, and the element is about to stop reporting one.
        reportProgress();
        clearInterval(progressTimer);

        hls?.destroy();

        // Free the ffmpeg session rather than waiting for it to idle out.
        if (mode === "transcode" && itemId !== undefined && typeof fetch !== "undefined") {
            fetch(`/api/stream/${itemId}/hls/index.m3u8`, { method: "DELETE" }).catch(() => {});
        }
    });

    function onVideoError() {
        const code = videoElement?.error?.code;

        // The element could not decode what we handed it. If we were direct
        // playing, escalate rather than showing a dead player.
        if (code === MediaError.MEDIA_ERR_DECODE || code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
            if (mode === "direct") {
                console.log("Direct play failed to decode; falling back to remux.");
                startRemux();
                return;
            }

            if (mode === "remux") {
                console.log("Remux failed to decode; falling back to transcoding.");
                startHls();
                return;
            }

            if (mode === "external") {
                // Nothing to escalate to: there is no library file behind this,
                // so remux and transcode have nothing to read.
                error = "This browser cannot play this video.";
                return;
            }
        }

        error = "This file could not be played.";
    }
</script>

{#if error}
    <div class="flex h-full w-full items-center justify-center rounded-lg bg-red-500/10 p-8">
        <p class="text-center text-sm text-red-400">{error}</p>
    </div>
{:else}
    <div class="relative {className}">
        <!-- svelte-ignore a11y_media_has_caption -->
        <!--
            object-contain is stated rather than left to the UA default so the
            frame is never cropped at rest: the overlay's zoom model treats
            scale 1 as "the whole frame is visible", and a cover-fitted element
            would silently break that contract.
        -->
        <video
            bind:this={videoElement}
            onerror={onVideoError}
            onloadedmetadata={applyResume}
            oncanplay={attemptPlay}
            onplay={startProgressReporting}
            onpause={reportProgress}
            {controls}
            {poster}
            autoplay
            controlslist="nofullscreen noremoteplayback nodownload"
            disablepictureinpicture
            class="h-full w-full rounded-lg bg-black object-contain"
            playsinline>
        </video>
        {#if loading}
            <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div
                    class="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white">
                </div>
            </div>
        {/if}
    </div>
{/if}
