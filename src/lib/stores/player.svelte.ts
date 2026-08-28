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

class PlayerStore {
    current = $state<PlayerTarget | null>(null);

    open(itemId: number, title: string) {
        if (nativePlayerAvailable()) {
            window.RivenNative!.play(toGuid(itemId));
            return;
        }
        this.current = { kind: "library", itemId, title };
    }

    openDirect(src: string, title: string, mimeType = "video/mp4", poster?: string) {
        // External player chosen: hand over the scraped URL itself. Nothing
        // about it is Jellyfin-shaped -- it is the site's own media URL --
        // so the player has no session to carry and no reason to come back
        // to us. `openExternal` returns false if the shell cannot do it, in
        // which case fall through rather than leaving the tap dead.
        if (window.RivenNative?.externalPlayerSelected?.()) {
            const absolute = new URL(src, window.location.href).href;

            if (window.RivenNative.openExternal(absolute)) return;
        }

        if (nativePlayerAvailable()) {
            playDirectNative(src, mimeType);
            return;
        }
        this.current = { kind: "direct", src, mimeType, title, poster };
    }

    close() {
        this.current = null;
    }
}

export const player = new PlayerStore();

/** Convenience for card components, which usually hold a nullable id. */
export function openPlayer(itemId: number | null | undefined, title: string) {
    if (!itemId) return;
    player.open(itemId, title);
}
