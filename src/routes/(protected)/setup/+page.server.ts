import type { Actions, PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import {
    markFirstLaunchSetupComplete,
    isFirstLaunchSetupComplete,
    isInitialSetupPhase
} from "$lib/server/first-launch";
import { actions as settingsActions, load as settingsLoad } from "../settings/+page.server";

export const load: PageServerLoad = async (event) => {
    if (!event.locals.user || !event.locals.session) {
        return redirect(302, "/auth/login");
    }

    const initialSetupPhase = await isInitialSetupPhase();
    const setupComplete = await isFirstLaunchSetupComplete(
        event.locals.backendUrl,
        event.locals.apiKey,
        event.fetch
    );
    if (!initialSetupPhase || setupComplete) {
        return redirect(302, "/");
    }

    return settingsLoad(event as never);
};

export const actions = {
    ...(settingsActions as unknown as Record<string, never>),
    completeSetup: async ({ fetch, locals }) => {
        await markFirstLaunchSetupComplete(locals.backendUrl, locals.apiKey, fetch);
        return redirect(303, "/");
    }
} satisfies Actions;
