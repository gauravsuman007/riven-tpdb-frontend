import { redirect, fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { auth } from "$lib/server/auth";
import { APIError } from "better-auth/api";
import { getAuthProviders } from "$lib/server/auth";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("auth-tv");

/*
    No client-side rendering, exactly as for /tv itself -- this page exists to
    be usable by the browser that cannot run the ordinary login page.
*/
export const csr = false;

export const load: PageServerLoad = async (event) => {
    if (event.locals.user) redirect(302, "/tv");

    return { enabled: getAuthProviders().credential?.enabled === true };
};

export const actions: Actions = {
    /*
        A plain username/password sign-in, deliberately thinner than the one
        on /auth/login.

        It does not offer the trusted-network passwordless path, and that is
        not an oversight: this page is reached from a TV, which reaches the
        app through the multiplexer, so the connecting address the server sees
        is the proxy's rather than the television's. The bypass would either
        never match or -- worse -- match the proxy and hand an account to
        anything able to reach it.

        Nor does it use superforms. That library's error reporting is
        delivered by client-side JavaScript, which is the one thing this page
        is guaranteed not to have.
    */
    default: async (event) => {
        if (getAuthProviders().credential?.enabled !== true) {
            return fail(403, { error: "Password sign-in is disabled.", username: "" });
        }

        const form = await event.request.formData();
        const username = String(form.get("username") ?? "").trim();
        const password = String(form.get("password") ?? "");

        if (!username || !password) {
            return fail(400, { error: "Enter a username and a password.", username });
        }

        try {
            await auth.api.signInUsername({
                body: { username, password, callbackURL: "/tv" },
                headers: event.request.headers
            });
        } catch (error) {
            if (error instanceof APIError) return fail(400, { error: error.message, username });

            logger.error("TV sign-in failed:", error);
            return fail(500, { error: "Something went wrong signing in.", username });
        }

        redirect(303, "/tv");
    }
};
