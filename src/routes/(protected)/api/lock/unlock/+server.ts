import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { unlock } from "$lib/server/app-lock";

/** Rate limit per user, in memory: four digits is 10,000 guesses. */
const attempts = new Map<string, { count: number; until: number }>();

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) error(401, "Not signed in");

    const userId = locals.user.id;
    const now = Date.now();
    const record = attempts.get(userId);

    if (record && record.count >= MAX_ATTEMPTS && now < record.until) {
        error(429, `Too many attempts. Try again in ${Math.ceil((record.until - now) / 1000)}s.`);
    }

    const body = await request.json().catch(() => ({}));
    const pin = String(body?.pin ?? "");

    if (unlock(userId, pin)) {
        attempts.delete(userId);
        return json({ ok: true });
    }

    /*
        Throttled rather than merely rejected. A four-digit code is 10,000
        possibilities, which an unthrottled endpoint gives up in minutes --
        and the whole point of the lock is that the attacker already has the
        device and can script against it.
    */
    const next = record && now < record.until ? record.count + 1 : 1;
    attempts.set(userId, { count: next, until: now + LOCKOUT_MS });

    error(401, "Incorrect PIN");
};
