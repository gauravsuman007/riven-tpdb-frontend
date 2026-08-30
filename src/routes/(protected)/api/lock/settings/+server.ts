import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { PIN_PATTERN, clearPin, getLockState, lockNow, setPin, setScopes } from "$lib/server/app-lock";

function view(userId: string) {
    const state = getLockState(userId);

    // The hash is never returned, only whether one exists.
    return {
        enabled: state.enabled,
        hasPin: state.hasPin,
        timeoutMinutes: state.timeoutMinutes,
        lockFrontend: state.lockFrontend,
        lockBackend: state.lockBackend
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

    if (action === "lock") {
        lockNow(userId);
        return json({ ok: true });
    }

    /*
        Changing which surfaces are covered must not require retyping the PIN.
        Toggling a checkbox and being asked for the code again would be
        friction with no security value -- the session is already
        authenticated and unlocked to have reached here.
    */
    if (action === "scopes") {
        const changed = setScopes(userId, {
            lockFrontend: typeof body?.lockFrontend === "boolean" ? body.lockFrontend : undefined,
            lockBackend: typeof body?.lockBackend === "boolean" ? body.lockBackend : undefined
        });

        if (!changed) error(400, "Set a PIN before choosing what it locks");

        return json({ ok: true, ...view(userId) });
    }

    const pin = String(body?.pin ?? "");

    if (!PIN_PATTERN.test(pin)) error(400, "PIN must be exactly four digits");

    setPin(userId, pin, Number(body?.timeoutMinutes ?? 10), {
        lockFrontend: typeof body?.lockFrontend === "boolean" ? body.lockFrontend : undefined,
        lockBackend: typeof body?.lockBackend === "boolean" ? body.lockBackend : undefined
    });

    return json({ ok: true, ...view(userId) });
};
