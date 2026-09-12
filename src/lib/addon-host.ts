import { player } from "$lib/stores/player.svelte";

/**
 * What the host lends an add-on beyond its own API.
 *
 * Kept to almost nothing on purpose. Anything reachable over HTTP the add-on
 * should fetch for itself -- bookmarks and VPN status are same-origin
 * endpoints, and routing them through a bridge would mean this app had to
 * grow a method every time an add-on wanted a URL it could already ask for.
 *
 * The player is the exception, and the reason the bridge exists at all: it is
 * in-page reactive state owned by this app's Svelte runtime, and the add-on's
 * bundle carries a different one. There is no way to hand that across except
 * as a function call.
 *
 * Built here rather than in each mount point so a page add-on and a slot
 * add-on are lent exactly the same thing. They were not, and that is how
 * OnlyFans -- a page -- ended up with a `<video>` of its own while the tube
 * scraper -- a slot -- used the host's player.
 */
export type HostBridge = {
    /** Open a scraped video in the host's player, with everything the player
     *  needs to offer an external app, a bookmark, or a quality choice.
     *  Mirrors `player.openDirect`. */
    play: (options: {
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
    }) => void;
};

export function hostBridge(key: string): HostBridge {
    return {
        /*
            `addon` is filled in HERE, not by the add-on.

            Everything downstream of the player that has to reach back to a
            scraper -- the external-player link, the on-demand resolution
            lookup -- needs to know WHICH add-on owns the site key, because
            two of them now serve sites and each answers only for its own. The
            add-on itself never has to think about it: the mount point already
            knows its key, and an add-on that forgot to pass one would produce
            requests that are silently answered by the wrong add-on.
        */
        play: (options) => player.openDirect({ ...options, addon: key })
    };
}
