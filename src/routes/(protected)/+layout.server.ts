import type { LayoutServerLoad } from "./$types";
import { getLockState } from "$lib/server/app-lock";

export const load = (async ({ locals }) => {
    const lock = locals.user
        ? getLockState(locals.user.id)
        : { enabled: false, timeoutMinutes: 10, lockFrontend: false };

    return {
        user: locals.user,
        /*
            Only what the client guard needs to run its own idle clock.
            Never the PIN or its hash -- the guard's job is to cover the
            screen and navigate, and the server does the deciding.
        */
        appLock: {
            /*
                Gated on the FRONTEND scope specifically. The client guard
                exists to cover the screen and navigate to the lock page, and
                neither is meaningful when only the backend API is locked --
                it would blank a UI that the server is perfectly willing to
                keep serving.
            */
            enabled: lock.enabled && lock.lockFrontend,
            timeoutMinutes: lock.timeoutMinutes
        }
    };
}) satisfies LayoutServerLoad;
