import { json, error } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import type { RequestHandler } from "./$types";

/**
 * The bridge to riven-tv's pairing, for approving a television from here.
 *
 * riven-tv holds the pairing state because that is where the television
 * asks -- the set keeps no cookies, so it has a session only in its own
 * URL, and duplicating that here would mean two services believing they
 * own the same sign-in.
 *
 * The proxy exists because the browser must NOT call riven-tv directly.
 * It is a different origin, so a credentialed call needs CORS, and riven-tv
 * deliberately sends none: "approve a television" is not a thing a page on
 * some other origin should be able to ask for on the viewer's behalf. This
 * runs on the server, forwards the viewer's own cookie, and riven-tv checks
 * it by asking us who it belongs to.
 */

const RIVEN_TV = (env.RIVEN_TV_URL || "http://riven-tv:3200").replace(/\/+$/, "");

/** Pending requests, so the prompt knows whether to appear at all. */
export const GET: RequestHandler = async ({ locals, request }) => {
    if (!locals.user) error(401, "Unauthorized");

    try {
        const response = await fetch(`${RIVEN_TV}/api/pairings`, {
            headers: { cookie: request.headers.get("cookie") ?? "" }
        });

        if (!response.ok) return json({ pending: [] });

        return json(await response.json());
    } catch {
        /*
            An empty list, not an error. This is polled in the background
            of every page; riven-tv being down or absent is a perfectly
            ordinary state and must not put a red banner on the app.
        */
        return json({ pending: [] });
    }
};

/** Answer one, by choosing the number the television is showing. */
export const POST: RequestHandler = async ({ locals, request }) => {
    if (!locals.user) error(401, "Unauthorized");

    const body = await request.formData();

    try {
        const response = await fetch(`${RIVEN_TV}/api/pairings/approve`, {
            method: "POST",
            headers: {
                cookie: request.headers.get("cookie") ?? "",
                "content-type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                id: String(body.get("id") ?? ""),
                choice: String(body.get("choice") ?? "")
            })
        });

        return json(await response.json(), { status: response.status });
    } catch {
        return json({ ok: false, message: "Could not reach the TV service." }, { status: 502 });
    }
};
