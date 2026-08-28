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
    import Hls from "hls.js";

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
    }

    interface PlaybackInfo {
        mode: "direct" | "remux" | "transcode";
        mime_type: string | null;
        reason: string;
        probe: {
            duration: number;
            video_codec: string | null;
            audio_codec: string | null;
            container: string | null;
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
        duration = $bindable()
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

    onMount(async () => {
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
