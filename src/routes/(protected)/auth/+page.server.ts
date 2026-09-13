/*
    The profile is a tab on the settings page now, not a page of its own.

    Kept as a redirect rather than deleted: the sidebar's avatar and every
    older link point here, and `/auth` also has to keep resolving because
    `/auth/login` and its siblings live beneath it. The load and the four
    form actions moved to `$lib/server/profile.ts`, which `/settings`
    registers; the markup is `$lib/components/settings/profile-panel.svelte`.
*/

import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (() => {
    redirect(308, "/settings?tab=profile");
}) satisfies PageServerLoad;
