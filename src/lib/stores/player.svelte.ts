/**
 * Global overlay-player state.
 *
 * Play buttons live on poster cards all over the app -- home, library, search,
 * detail pages, the hero. Threading an open/close callback down to every one of
 * them would mean touching every intermediate component, so the player is
 * opened through this store and rendered once in the protected layout.
 */

interface PlayerTarget {
    /** Riven media item id -- what the stream endpoints are keyed on. */
    itemId: number;
    title: string;
}

class PlayerStore {
    current = $state<PlayerTarget | null>(null);

    open(itemId: number, title: string) {
        this.current = { itemId, title };
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
