import { toGuid } from "$lib/utils/jellyfin-ids";

/**
 * Global overlay-player state.
 *
 * Play buttons live on poster cards all over the app -- home, library, search,
 * detail pages, the hero. Threading an open/close callback down to every one of
 * them would mean touching every intermediate component, so the player is
 * opened through this store and rendered once in the protected layout.
 *
 * Inside the Jellyfin WebView shell (official Android app, LG webOS), the
 * in-page overlay must never open at all: it renders a `<video>` with no
 * player behind it (ExoPlayer runs as a native overlay outside our DOM), and
 * its `touch-action:none` seek/zoom stage eats the OS edge-swipe-back
 * gesture for a player the user can't even see. Route straight to the
 * native player instead of setting `current`.
 */
function nativePlayerAvailable(): boolean {
    return typeof window !== "undefined" && !!window.RivenNative?.available();
}

interface LibraryTarget {
    kind: "library";
    /** Riven media item id -- what the stream endpoints are keyed on. */
    itemId: number;
    title: string;
}

interface DirectTarget {
    kind: "direct";
    /**
     * A video found on a streaming site rather than in the library. There is
     * no item id and never will be: nothing was downloaded, so the URL is all
     * there is to identify it by.
     */
    src: string;
    mimeType: string;
    title: string;
    poster?: string;
    /**
     * Identifies this video for bookmarking and metadata lookup -- the site
     * key and the site's own video id, same pair `/direct/sources` and the
     * bookmarks API are keyed on. Optional because a caller that only has a
     * bare URL (nothing scraped it, there is no site/id to speak of) can
     * still play one; it just cannot be bookmarked from the player.
     */
    site?: string;
    videoId?: string;
    /** Context the bookmark should be scoped to -- see schema/bookmarks.ts. */
    contextTitle?: string;
    duration?: number | null;
    resolution?: string | null;
    size?: number | null;
}

export type PlayerTarget = LibraryTarget | DirectTarget;

/**
 * A direct-site video has no library item id, so it can never go through the
 * Jellyfin bridge (NativePlayer only resolves ids via PlaybackInfo). Inside
 * the WebView shell this instead plays through a bare native `<video>` and
 * its own OS-level fullscreen player (`webkitEnterFullscreen`/
 * `requestFullscreen`), never mounting the custom overlay -- that gets a
 * real native back gesture for free, unlike the overlay's swipe-to-seek
 * stage.
 */
function playDirectNative(src: string, mimeType: string): void {
    const video = document.createElement("video");
    video.src = src;
    if (mimeType) video.setAttribute("type", mimeType);
    video.controls = true;
    video.playsInline = false;
    video.style.position = "fixed";
    video.style.inset = "0";
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.zIndex = "9999";
    video.style.background = "black";
    document.body.appendChild(video);

    const cleanup = () => video.remove();
    video.addEventListener("webkitendfullscreen", cleanup, { once: true });
    document.addEventListener(
        "fullscreenchange",
        () => {
            if (!document.fullscreenElement) cleanup();
        },
        { once: true }
    );

    video.play().catch(() => {});
    const enterFullscreen = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    if (enterFullscreen.webkitEnterFullscreen) {
        enterFullscreen.webkitEnterFullscreen();
    } else if (video.requestFullscreen) {
        video.requestFullscreen().catch(() => {});
    }
}

/**
 * Where a resume point is kept, and for how long it stays good.
 *
 * `localStorage`, not `sessionStorage`, because the case this exists for is a
 * foldable unfolding mid-playback: the screen geometry changes, Android
 * recreates the activity, and the WebView is torn down and rebuilt on the
 * start URL -- which loses the SPA route, the store, and any session storage
 * with it. A restart that fast is indistinguishable from a plain reload from
 * in here, so both are treated the same and the player comes back.
 *
 * The age window is what keeps that from becoming a nuisance: reopening the
 * app the next morning must not resurrect last night's video. Only a reload
 * that lands within the window restores, and closing the player deliberately
 * clears the record outright.
 */
const RESUME_KEY = "riven:player-resume";
const RESUME_MAX_AGE_MS = 30 * 60 * 1000;

interface ResumeRecord {
    target: PlayerTarget;
    position: number;
    savedAt: number;
}

class PlayerStore {
    current = $state<PlayerTarget | null>(null);

    /**
     * Seconds to seek to once the restored target's metadata arrives, or null
     * for a normal open. Read and cleared by the overlay -- a resume point is
     * only good for the load it was restored on.
     */
    resumeAt = $state<number | null>(null);

    open(itemId: number, title: string) {
        if (nativePlayerAvailable()) {
            window.RivenNative!.play(toGuid(itemId));
            return;
        }
        this.current = { kind: "library", itemId, title };
    }

    openDirect(options: {
        src: string;
        title: string;
        mimeType?: string;
        poster?: string;
        site?: string;
        videoId?: string;
        contextTitle?: string;
        duration?: number | null;
        resolution?: string | null;
        size?: number | null;
    }) {
        const { src, title, mimeType = "video/mp4", poster } = options;

        // External player chosen: hand over the scraped URL itself. Nothing
        // about it is Jellyfin-shaped -- it is the site's own media URL --
        // so the player has no session to carry and no reason to come back
        // to us. `openExternal` returns false if the shell cannot do it, in
        // which case fall through rather than leaving the tap dead.
        if (window.RivenNative?.externalPlayerSelected?.() && options.site && options.videoId) {
            /*
                Minted rather than handing over `src` directly. That URL is
                cookie-authenticated and extensionless, so another app can
                neither fetch it nor be matched to it by Android's intent
                resolver -- which sent it to the browser as a download. The
                minted one carries its own token and ends in .mp4.

                Async, so the in-page fallbacks below cannot run first: the
                await is inside an immediately-invoked async function and this
                returns straight after scheduling it.
            */
            const query = new URLSearchParams({
                site: options.site,
                videoId: options.videoId,
                title: title || "video"
            });

            void (async () => {
                try {
                    const response = await fetch(`/api/direct/external_url?${query}`);

                    if (response.ok) {
                        const { url } = await response.json();

                        if (url && window.RivenNative?.openExternal(url)) return;
                    }
                } catch {
                    // Fall through to the in-page player below.
                }

                this.current = {
                    kind: "direct",
                    src,
                    mimeType,
                    title,
                    poster,
                    site: options.site,
                    videoId: options.videoId,
                    contextTitle: options.contextTitle,
                    duration: options.duration,
                    resolution: options.resolution,
                    size: options.size
                };
            })();

            return;
        }

        if (nativePlayerAvailable()) {
            playDirectNative(src, mimeType);
            return;
        }
        this.current = {
            kind: "direct",
            src,
            mimeType,
            title,
            poster,
            site: options.site,
            videoId: options.videoId,
            contextTitle: options.contextTitle,
            duration: options.duration,
            resolution: options.resolution,
            size: options.size
        };
    }

    /**
     * Record where playback has got to, so a WebView restart can pick it up.
     * Called from the player's timeupdate handler, so it runs about four
     * times a second -- cheap enough to write straight through, and writing
     * on an interval instead would risk missing the last seconds before the
     * activity dies, which is exactly the position worth keeping.
     */
    remember(position: number) {
        if (typeof localStorage === "undefined" || !this.current) return;

        const record: ResumeRecord = {
            target: this.current,
            position,
            savedAt: Date.now()
        };

        try {
            localStorage.setItem(RESUME_KEY, JSON.stringify(record));
        } catch {
            // Private mode, or the quota is full. Losing the resume point is
            // not worth breaking playback over.
        }
    }

    /** Drop the resume point. Closing the player is a deliberate stop. */
    forget() {
        this.resumeAt = null;
        if (typeof localStorage === "undefined") return;
        try {
            localStorage.removeItem(RESUME_KEY);
        } catch {
            // See remember().
        }
    }

    /**
     * Reopen whatever was playing when the page last went away, if it went
     * away recently enough. Called once from the protected layout on mount.
     */
    restore() {
        if (typeof localStorage === "undefined" || this.current) return;

        let record: ResumeRecord | null = null;

        try {
            const raw = localStorage.getItem(RESUME_KEY);
            record = raw ? (JSON.parse(raw) as ResumeRecord) : null;
        } catch {
            record = null;
        }

        if (!record?.target || typeof record.savedAt !== "number") return;

        if (Date.now() - record.savedAt > RESUME_MAX_AGE_MS) {
            this.forget();
            return;
        }

        // The shell plays library titles natively; reopening the overlay
        // behind ExoPlayer would put a second, invisible player on screen.
        if (record.target.kind === "library" && nativePlayerAvailable()) {
            this.forget();
            return;
        }

        this.resumeAt = record.position > 0 ? record.position : null;
        this.current = record.target;
    }

    close() {
        this.forget();
        this.current = null;
    }
}

export const player = new PlayerStore();

/** Convenience for card components, which usually hold a nullable id. */
export function openPlayer(itemId: number | null | undefined, title: string) {
    if (!itemId) return;
    player.open(itemId, title);
}
