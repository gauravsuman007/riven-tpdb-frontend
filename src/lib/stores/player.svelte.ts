/**
 * Global overlay-player state.
 *
 * Play buttons live on poster cards all over the app -- home, library, search,
 * detail pages, the hero. Threading an open/close callback down to every one of
 * them would mean touching every intermediate component, so the player is
 * opened through this store and rendered once in the protected layout.
 */

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

class PlayerStore {
    current = $state<PlayerTarget | null>(null);

    open(itemId: number, title: string) {
        this.current = { kind: "library", itemId, title };
    }

    openDirect(src: string, title: string, mimeType = "video/mp4", poster?: string) {
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
