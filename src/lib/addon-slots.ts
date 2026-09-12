/*
    Add-on contributions to the HOST's own pages.

    A page is the right shape for an add-on that owns a screen. It is the
    wrong shape for one whose entire interface belongs *inside* something the
    host already renders -- a panel on a title's page cannot be a route
    without tearing the page in half. A slot is that second shape: the host
    names a place, an add-on says it fills it, and the host mounts the
    add-on's bundle there.

    THE ABSENT CASE IS THE IMPORTANT ONE. When no loaded add-on claims a slot,
    the host must render *nothing* -- not an empty panel, not a placeholder
    explaining what is missing. Uninstalling the add-on has to take its
    section away with it, or "remove" would leave a scar on every title page.
    That is why `slotted()` answers with a list that is simply empty, and why
    the component below renders no wrapper element until something mounts.
*/

import { listAddons, type Addon } from "$lib/addons";

/*
    One request per page load, shared by every slot on it.

    A title's page can host several slots, and each asking the backend
    separately would be several identical round trips to decide, usually, that
    there is nothing to show. Memoised as the in-flight PROMISE rather than
    its result so that simultaneous callers share one request instead of
    racing to start their own.
*/
let inflight: Promise<Addon[]> | null = null;

async function loaded(): Promise<Addon[]> {
    const response = await listAddons();
    return "addons" in response ? response.addons.addons : [];
}

export function addons(): Promise<Addon[]> {
    inflight ??= loaded().catch(() => {
        // A failed lookup must not be cached as "there are no add-ons" for
        // the rest of the session: the backend being briefly unreachable
        // would then hide a working add-on's section until a reload.
        inflight = null;
        return [];
    });

    return inflight;
}

/** Forget the cached list. Called when add-ons are installed or removed, so a
 *  section appears or disappears without a page reload. */
export function resetAddonSlots(): void {
    inflight = null;
}

/** Which loaded add-ons fill a named slot.
 *
 *  `state === "ok"` is what makes "disabled" and "failed" behave the way the
 *  user expects: a disabled add-on still appears in Settings, where it can be
 *  switched back on, but contributes nothing to a page. */
export async function slotted(name: string): Promise<Addon[]> {
    return (await addons()).filter(
        (addon) => addon.state === "ok" && (addon.slots ?? []).includes(name)
    );
}
