import { auth } from "$lib/server/auth";
import { redirect, error, type Handle, type ServerInit } from "@sveltejs/kit";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";
import { sequence } from "@sveltejs/kit/hooks";
import { env } from "$env/dynamic/private";
import providers from "$lib/providers";
import { dev } from "$app/environment";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "$lib/server/db";
import { user } from "$lib/server/schema";
import { eq, or } from "drizzle-orm";
import { createCustomFetch } from "$lib/custom-fetch";
import { createScopedLogger } from "$lib/logger";
import { isTrustedAddress, loadLocalAccessConfig } from "$lib/server/local-access";

const logger = createScopedLogger("hooks");

export const init: ServerInit = async () => {
    if (!env.BACKEND_URL) {
        throw new Error("BACKEND_URL environment variable is required");
    }
    if (!env.BACKEND_API_KEY) {
        throw new Error("BACKEND_API_KEY environment variable is required");
    }
    migrate(db, { migrationsFolder: "drizzle" });

    // @ts-expect-error ignore
    logger.box(`Riven Frontend v${__APP_VERSION__}`);
};

/**
 * Sign a trusted-network client in without a password.
 *
 * Only reached when there is no real session. It grants an account that already
 * exists -- never creates one -- so the user's role still governs what they can
 * do; this only decides who they are. Returns null whenever anything is not
 * exactly right, which sends the request to the login screen as before.
 */
const localAccessSession = async (event: Parameters<Handle>[0]["event"]) => {
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
        // Adapters that cannot report a peer address (prerender, some
        // serverless hosts) must not be treated as a trusted one.
        return null;
    }

    if (!isTrustedAddress(address, config)) return null;

    // Read the account straight from the auth database. The admin API's user
    // listing needs an admin session to call, and by definition there is no
    // session here yet.
    const account = config.username
        ? db
              .select()
              .from(user)
              .where(
                  or(
                      eq(user.username, config.username),
                      eq(user.name, config.username),
                      eq(user.email, config.username)
                  )
              )
              .get()
        : // No name configured: the oldest admin, so which account gets picked
          // does not change as users are added.
          db
              .select()
              .from(user)
              .where(eq(user.role, "admin"))
              .orderBy(user.createdAt)
              .get();

    if (!account) {
        logger.error(
            `Local access is enabled for ${address} but no account matches ` +
                (config.username ? `"${config.username}"` : "the admin role") +
                "; falling back to the login screen"
        );
        return null;
    }

    // A session object rather than a signed cookie: the trust comes from the
    // network the request arrived on, and is re-established per request, so
    // there is nothing to leak and nothing to revoke.
    return {
        user: account,
        session: {
            id: `local-access:${address}`,
            userId: account.id,
            token: "",
            createdAt: new Date(),
            updatedAt: new Date(),
            expiresAt: new Date(Date.now() + 60_000),
            ipAddress: address,
            userAgent: event.request.headers.get("user-agent") ?? ""
        }
    };
};

export const betterAuthHandler: Handle = async ({ event, resolve }) => {
    if (event.route.id?.startsWith("/(protected)")) {
        const session = await auth.api.getSession({
            headers: event.request.headers
        });

        if (session) {
            event.locals.session = session?.session;
            event.locals.user = session?.user;
            return svelteKitHandler({ event, resolve, auth, building });
        }

        const local = await localAccessSession(event);

        if (local) {
            event.locals.session = local.session as typeof event.locals.session;
            event.locals.user = local.user as typeof event.locals.user;
            return svelteKitHandler({ event, resolve, auth, building });
        }

        redirect(307, "/auth/login");
    } else {
        return svelteKitHandler({ event, resolve, auth, building });
    }
};

const configureLocals: Handle = async ({ event, resolve }) => {
    event.locals.backendUrl = env.BACKEND_URL;
    event.locals.apiKey = env.BACKEND_API_KEY;

    return resolve(event);
};

const handleTVDBCookie: Handle = async ({ event, resolve }) => {
    const tvdbCookie = event.cookies.get("tvdb_cookie");

    if (!tvdbCookie) {
        const customFetch = createCustomFetch(event.fetch);
        const tvdbLogin = await providers.tvdb.POST("/login", {
            body: {
                apikey: "6be85335-5c4f-4d8d-b945-d3ed0eb8cdce"
            },
            fetch: customFetch
        });

        if (tvdbLogin.error) {
            error(500, "Failed to login to TVDB: " + tvdbLogin.error);
        } else {
            event.cookies.set("tvdb_cookie", tvdbLogin.data?.data?.token || "", {
                path: "/",
                httpOnly: true,
                sameSite: "lax",
                secure: !dev,
                maxAge: 60 * 60 * 24 * 30 // 30 days
            });
            logger.info("Set TVDB cookie");
        }
    }

    return resolve(event);
};

export const handle: Handle = sequence(configureLocals, betterAuthHandler, handleTVDBCookie);
