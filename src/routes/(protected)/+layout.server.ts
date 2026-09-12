import type { LayoutServerLoad } from "./$types";
import { getLockState } from "$lib/server/app-lock";
import { listAddons, type AddonNav } from "$lib/addons";

export const load = (async ({ locals, fetch }) => {
    const lock = locals.user
        ? getLockState(locals.user.id)
        : { enabled: false, timeoutMinutes: 10 };

    /*
        The sidebar's add-on entries. Failing to reach the backend costs the
        add-on links and nothing else -- the rest of the navigation is static
        and must not disappear because one request did.
    */
    let addonNav: AddonNav[] = [];

    try {
        const result = await listAddons(fetch);

        if ("addons" in result) {
            addonNav = result.addons.addons
                .filter((addon) => addon.state === "ok" && addon.nav)
                .map((addon) => addon.nav as AddonNav);
        }
    } catch {
        addonNav = [];
    }

    return {
        user: locals.user,
        addonNav,
        /*
            Only what the client guard needs to run its own idle clock. Never
            the PIN or its hash: the guard covers the screen, and the PIN is
            checked by /api/lock/unlock, which is the one thing still done on
            the server.
        */
        appLock: {
            enabled: lock.enabled,
            timeoutMinutes: lock.timeoutMinutes
        }
    };
}) satisfies LayoutServerLoad;
