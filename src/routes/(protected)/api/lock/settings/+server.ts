import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { PIN_PATTERN, clearPin, getLockState, lockNow, setPin } from "$lib/server/app-lock";

export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.user) error(401, "Not signed in");

    const state = getLockState(locals.user.id);

    // The hash is never returned, only whether one exists.
    return json({
        enabled: state.enabled,
        hasPin: state.hasPin,
        timeoutMinutes: state.timeoutMinutes
    });
};

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) error(401, "Not signed in");

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    if (action === "disable") {
        clearPin(locals.user.id);
        return json({ ok: true, enabled: false, hasPin: false });
    }

    if (action === "lock") {
        lockNow(locals.user.id);
        return json({ ok: true });
    }

    const pin = String(body?.pin ?? "");

    if (!PIN_PATTERN.test(pin)) error(400, "PIN must be exactly four digits");

    const timeout = Number(body?.timeoutMinutes ?? 10);

    setPin(locals.user.id, pin, timeout);

    const state = getLockState(locals.user.id);

    return json({ ok: true, enabled: state.enabled, hasPin: true, timeoutMinutes: state.timeoutMinutes });
};
