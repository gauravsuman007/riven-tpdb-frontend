import { redirect } from "@sveltejs/kit";
import { message, superValidate, fail, setError } from "sveltekit-superforms";
import { loginSchema, registerSchema } from "$lib/schemas/auth";
import type { Actions, PageServerLoad } from "./$types";
import { zod4 } from "sveltekit-superforms/adapters";
import { auth } from "$lib/server/auth";
import { APIError } from "better-auth/api";
import { getUsersCount } from "$lib/server/functions";
import { getAuthProviders } from "$lib/server/auth";
import { createScopedLogger } from "$lib/logger";
import {
    LOCAL_ACCOUNT_COOKIE,
    isTrustedAddress,
    loadLocalAccessConfig
} from "$lib/server/local-access";
import { db } from "$lib/server/db";
import { user } from "$lib/server/schema";
import { eq, or } from "drizzle-orm";

const logger = createScopedLogger("auth");

const authProviders = getAuthProviders();
const isSignupEnabled =
    authProviders.credential?.enabled && !authProviders.credential?.disableSignup;
const isCredentialEnabled = authProviders.credential?.enabled;

export const load: PageServerLoad = async (event) => {
    if (event.locals.user) {
        return redirect(302, "/auth");
    }

    const isFirstUser = await noUserExists();
    const canRegister = isSignupEnabled || isFirstUser;

    const loginForm = await superValidate(zod4(loginSchema), {
        id: "loginForm"
    });

    // Only to decide whether to TELL the user the empty-password path exists.
    // The grant itself is re-derived server-side on submit; nothing here is
    // load-bearing for access.
    const localAccess = (await localSignInAvailable(event)) !== false;
    const registerForm = canRegister
        ? await superValidate(zod4(registerSchema), { id: "registerForm" })
        : null;
    return { loginForm, registerForm, authProviders, isFirstUser, localAccess };
};

/** Whether this connection could use the empty-password path at all. */
async function localSignInAvailable(event: Parameters<PageServerLoad>[0]): Promise<boolean> {
    try {
        const config = await loadLocalAccessConfig(
            event.locals.backendUrl,
            event.locals.apiKey,
            event.fetch
        );

        return config.enabled && isTrustedAddress(event.getClientAddress(), config);
    } catch {
        return false;
    }
}

async function noUserExists() {
    const count = await getUsersCount();
    return count === 0;
}


/**
 * Grant a trusted-network client the account it named, or nothing.
 *
 * Returns the stored username on success so the caller can pin the cookie to
 * the account's canonical name rather than whatever spelling was typed.
 *
 * Every gate here fails closed, in this order: the bypass must be switched on
 * in backend settings, the connection must come from one of the networks it
 * lists, and the account must already exist. It never creates an account and
 * never widens one's role -- it only decides which existing identity this
 * device gets, which is the same rule the address-only bypass already follows.
 */
async function localSignIn(
    event: Parameters<Actions["login"]>[0],
    username: string
): Promise<string | null> {
    const config = await loadLocalAccessConfig(
        event.locals.backendUrl,
        event.locals.apiKey,
        event.fetch
    );

    if (!config.enabled) return null;

    let address: string;

    try {
        address = event.getClientAddress();
    } catch {
        return null;
    }

    if (!isTrustedAddress(address, config)) return null;

    const account = db
        .select()
        .from(user)
        .where(or(eq(user.username, username), eq(user.name, username), eq(user.email, username)))
        .get();

    if (!account) {
        logger.warn(`Passwordless login from ${address} named no existing account`);
        return null;
    }

    logger.info(`Passwordless local login for "${username}" from ${address}`);

    return account.username ?? account.name ?? username;
}

export const actions: Actions = {
    login: async (event) => {
        if (!isCredentialEnabled) {
            return fail(403, { message: "Email/password login is disabled" });
        }

        const loginForm = await superValidate(event.request, zod4(loginSchema));
        if (!loginForm.valid) return fail(400, { loginForm });

        // An empty password is a request for the trusted-network path, not a
        // failed one. It is answered here rather than by better-auth because
        // better-auth has no notion of "who is asking from where" -- and it
        // must never reach signInUsername with a blank password, which would
        // be a very different thing to allow.
        if (loginForm.data.password === "") {
            const granted = await localSignIn(event, loginForm.data.username);

            if (!granted) {
                return message(loginForm, "A password is required from this network.", {
                    status: 401
                });
            }

            // Selects the account for `localAccessSession` in hooks.server.ts,
            // which re-checks the address on every request. httpOnly because
            // no client code has any reason to read it.
            event.cookies.set(LOCAL_ACCOUNT_COOKIE, granted, {
                path: "/",
                httpOnly: true,
                sameSite: "lax",
                secure: event.url.protocol === "https:",
                maxAge: 60 * 60 * 24 * 365
            });

            return redirect(303, "/");
        }

        try {
            await auth.api.signInUsername({
                body: {
                    username: loginForm.data.username,
                    password: loginForm.data.password,
                    callbackURL: "/"
                },
                headers: event.request.headers
            });
        } catch (error) {
            if (error instanceof APIError) {
                return message(loginForm, error.message, {
                    status: 400
                });
            }
            logger.error("Error during login:", error);
            return message(loginForm, "An unexpected error occurred", {
                status: 500
            });
        }

        return redirect(303, "/");
    },
    register: async (event) => {
        const isFirstUser = await noUserExists();

        // Allow registration if signup is enabled OR if this is the first user (admin setup)
        if (!isSignupEnabled && !isFirstUser) {
            return fail(403, { message: "Registration is disabled" });
        }

        const registerForm = await superValidate(event.request, zod4(registerSchema));
        if (!registerForm.valid) return fail(400, { registerForm });

        if (registerForm.data.password !== registerForm.data.confirmPassword) {
            return setError(registerForm, "confirmPassword", "Passwords do not match.");
        }

        try {
            const isFirstUser = await noUserExists();
            if (isFirstUser) {
                logger.info("No users exist, assigning admin role to the first registered user.");

                const data = await auth.api.createUser({
                    body: {
                        name: registerForm.data.username,
                        email: registerForm.data.email,
                        password: registerForm.data.password,
                        role: "admin",
                        data: {
                            username: registerForm.data.username,
                            image: registerForm.data.image || undefined
                        }
                    }
                });

                logger.info("First user (admin) created:", data);

                await auth.api.signInUsername({
                    body: {
                        username: registerForm.data.username,
                        password: registerForm.data.password,
                        callbackURL: "/"
                    },
                    headers: event.request.headers
                });
            } else {
                await auth.api.signUpEmail({
                    body: {
                        name: registerForm.data.username,
                        username: registerForm.data.username,
                        email: registerForm.data.email,
                        password: registerForm.data.password,
                        image: registerForm.data.image || undefined
                    }
                });
            }
        } catch (error) {
            if (error instanceof APIError) {
                return message(registerForm, error.message, {
                    status: 400
                });
            }
            logger.error("Error during sign up:", error);
            return message(registerForm, "An unexpected error occurred", {
                status: 500
            });
        }

        return redirect(303, "/");
    }
};
