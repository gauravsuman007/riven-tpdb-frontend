import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { getLockState, isLocked } from "$lib/server/app-lock";

export const load = (async ({ locals, url }) => {
    if (!locals.user) redirect(307, "/auth/login");

    const state = getLockState(locals.user.id);

    /*
        Not locked? Do not sit on the lock screen.

        This handles the second tab: unlocking in one tab must let every other
        tab back in, and they all land here first.
    */
    if (!isLocked(locals.user.id, "frontend")) {
        const next = url.searchParams.get("next");
        redirect(303, next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    }

    return {
        // Only what the lock screen needs to render. Nothing about the page
        // behind it, which is the entire point.
        next: url.searchParams.get("next") ?? "/",
        hasPin: state.hasPin
    };
}) satisfies PageServerLoad;
