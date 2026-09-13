import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getHiddenNav, setHiddenNav } from "$lib/server/nav-prefs";

export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.user) error(401, "Not signed in");

    return json({ hidden: getHiddenNav(locals.user.id) });
};

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) error(401, "Not signed in");

    const body = await request.json().catch(() => null);

    if (!body || !Array.isArray(body.hidden)) error(400, "Expected { hidden: string[] }");

    return json({ hidden: setHiddenNav(locals.user.id, body.hidden) });
};
