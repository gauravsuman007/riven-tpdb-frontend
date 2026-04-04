import type { Actions, PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { dev } from "$app/environment";
import {
    FIRST_LAUNCH_SETUP_COOKIE,
    isFirstLaunchSetupComplete,
    isInitialSetupPhase
} from "$lib/server/first-launch";
import { actions as settingsActions, load as settingsLoad } from "../settings/+page.server";

export const load: PageServerLoad = async (event) => {
    if (!event.locals.user || !event.locals.session) {
        return redirect(302, "/auth/login");
    }

    const initialSetupPhase = await isInitialSetupPhase();
    if (!initialSetupPhase || isFirstLaunchSetupComplete(event.cookies)) {
        return redirect(302, "/");
    }

    return settingsLoad(event as never);
};

export const actions = {
    ...(settingsActions as unknown as Record<string, never>),
    completeSetup: async ({ cookies }) => {
        cookies.set(FIRST_LAUNCH_SETUP_COOKIE, "true", {
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            secure: !dev,
            maxAge: 60 * 60 * 24 * 365
        });

        return redirect(303, "/");
    }
} satisfies Actions;
