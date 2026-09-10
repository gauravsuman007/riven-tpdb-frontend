import { redirect, fail } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { createScopedLogger } from "$lib/logger";
import type { Actions, PageServerLoad } from "./$types";

const logger = createScopedLogger("easy-signin");
const RIVEN_TV = (env.RIVEN_TV_URL || "http://riven-tv:3200").replace(/\/+$/, "");

/*
    Where the pairing id is kept while this browser waits.

    Not in the URL, and not in the page: presenting the id is what claims
    the session, so it is a bearer token for the length of the request. A
    short-lived, httpOnly cookie keeps it out of the address bar, out of
    history, and out of reach of anything running on the page.
*/
const HANDLE = "riven_pair_handle";
const HANDLE_MAX_AGE = 4 * 60;

/*
    `secure` has to follow the scheme, not default to on.

    SvelteKit sets `secure: true` unless the host is localhost, and this
    app is served over plain HTTP on the LAN -- so the default marks every
    cookie here Secure and the browser then never sends one back. It fails
    silently and looks exactly like a pairing that expired, which is how it
    was found: the handle came back "expired" one second after being set.
*/
const secureFor = (url: URL) => url.protocol === "https:";

export const load: PageServerLoad = async ({ locals }) => {
    if (locals.user) redirect(303, "/");

    return {};
};

export const actions: Actions = {
    /** Ask, and show the number this browser must be identified by. */
    start: async ({ cookies, request, url }) => {
        const label = /mobile|android|iphone/i.test(request.headers.get("user-agent") ?? "")
            ? "A phone or tablet"
            : "A browser";

        try {
            const response = await fetch(`${RIVEN_TV}/api/pairings/start`, {
                method: "POST",
                headers: { "content-type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ label })
            });

            if (!response.ok) {
                return fail(429, { error: "Too many sign-in requests are waiting. Try shortly." });
            }

            const pairing = (await response.json()) as { id: string; answer: number };

            cookies.set(HANDLE, pairing.id, {
                path: "/auth/easy",
                httpOnly: true,
                secure: secureFor(url),
                sameSite: "lax",
                maxAge: HANDLE_MAX_AGE
            });

            return { answer: pairing.answer };
        } catch (cause) {
            logger.error(`could not start pairing: ${cause}`);
            return fail(502, { error: "The sign-in service is not reachable." });
        }
    },

    /**
     * Has it been approved yet?
     *
     * On yes, riven-tv hands over the session the approving device gave
     * it -- once, and the pairing is destroyed with it -- and those cookies
     * are re-issued here as this browser's own. That is the whole
     * mechanism: the approver's session becomes this browser's session,
     * which is exactly what approving meant.
     */
    check: async ({ cookies, url }) => {
        const handle = cookies.get(HANDLE);

        if (!handle) return fail(400, { error: "That request has expired. Start again." });

        let payload: { status?: string; cookies?: string };

        try {
            const response = await fetch(`${RIVEN_TV}/api/pairings/${handle}`);
            payload = (await response.json()) as { status?: string; cookies?: string };
        } catch (cause) {
            logger.error(`could not check pairing: ${cause}`);
            return fail(502, { error: "The sign-in service is not reachable." });
        }

        if (payload.status === "denied") {
            cookies.delete(HANDLE, { path: "/auth/easy" });
            return fail(403, { error: "That request was refused: the wrong number was chosen." });
        }

        if (payload.status === "expired" || payload.status === "gone") {
            cookies.delete(HANDLE, { path: "/auth/easy" });
            return fail(410, { error: "That request timed out. Start again." });
        }

        if (payload.status !== "approved" || !payload.cookies) return { waiting: true };

        for (const pair of payload.cookies.split(";")) {
            const equals = pair.indexOf("=");

            if (equals <= 0) continue;

            /*
                Re-issued with this app's own attributes rather than the
                originals: what came back is a jar (`name=value; name=value`)
                with the flags long since stripped by the browser that
                stored it, so they have to be restated. httpOnly and lax
                are what better-auth sets these with.
            */
            cookies.set(pair.slice(0, equals).trim(), pair.slice(equals + 1).trim(), {
                path: "/",
                httpOnly: true,
                secure: secureFor(url),
                sameSite: "lax",
                maxAge: 60 * 60 * 24 * 30
            });
        }

        cookies.delete(HANDLE, { path: "/auth/easy" });

        redirect(303, "/");
    }
};
