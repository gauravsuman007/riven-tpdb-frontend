import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { PIN_PATTERN, clearPin, getLockState, setPin } from "$lib/server/app-lock";

function view(userId: string) {
    const state = getLockState(userId);

    // The hash is never returned, only whether one exists.
    return {
        enabled: state.enabled,
        hasPin: state.hasPin,
        timeoutMinutes: state.timeoutMinutes
    };
}

export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.user) error(401, "Not signed in");

    return json(view(locals.user.id));
};

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) error(401, "Not signed in");

    const userId = locals.user.id;
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    if (action === "disable") {
        clearPin(userId);
        return json({ ok: true, ...view(userId) });
    }

    const pin = String(body?.pin ?? "");

    if (!PIN_PATTERN.test(pin)) error(400, "PIN must be exactly four digits");

    setPin(userId, pin, Number(body?.timeoutMinutes ?? 10));

    return json({ ok: true, ...view(userId) });
};
