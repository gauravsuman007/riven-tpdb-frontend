import type { LayoutServerLoad } from "./$types";
import { getLockState } from "$lib/server/app-lock";

export const load = (async ({ locals }) => {
    const lock = locals.user
        ? getLockState(locals.user.id)
        : { enabled: false, timeoutMinutes: 10 };

    return {
        user: locals.user,
        /*
            Only what the client guard needs to run its own idle clock.
            Never the PIN or its hash -- the guard's job is to cover the
            screen and navigate, and the server does the deciding.
        */
        appLock: {
            enabled: lock.enabled,
            timeoutMinutes: lock.timeoutMinutes
        }
    };
}) satisfies LayoutServerLoad;
