/**
 * "A person is still here."
 *
 * Deliberately its own endpoint rather than a side effect of ordinary
 * requests: Riven's pages poll constantly, so a clock driven by request
 * traffic would never run down and the lock would never engage. Only real
 * input and advancing playback reach this.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { recordActivity } from "$lib/server/app-lock";

export const POST: RequestHandler = async ({ locals }) => {
    // Silently fine when signed out: the beacon can race a sign-out, and a
    // 401 there would be noise in the console for a request nobody reads.
    if (locals.user) recordActivity(locals.user.id);

    return json({ ok: true });
};
