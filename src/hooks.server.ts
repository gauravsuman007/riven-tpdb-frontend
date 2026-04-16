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
import { createCustomFetch } from "$lib/custom-fetch";
import { createScopedLogger } from "$lib/logger";
import { isInitialSetupPhase, isFirstLaunchSetupComplete } from "$lib/server/first-launch";

const logger = createScopedLogger("hooks");

function getBackendApiKey() {
    return env.BACKEND_API_KEY || env.RIVEN_SETTING__API_KEY;
}

function getBackendAuthSigningSecret() {
    return env.BACKEND_AUTH_SIGNING_SECRET || env.RIVEN_SETTING__FRONTEND_AUTH_SIGNING_SECRET;
}

export const init: ServerInit = async () => {
    if (!env.BACKEND_URL) {
        throw new Error("BACKEND_URL environment variable is required");
    }
    if (!getBackendApiKey()) {
        throw new Error(
            "BACKEND_API_KEY or RIVEN_SETTING__API_KEY environment variable is required"
        );
    }
    if (!getBackendAuthSigningSecret()) {
        throw new Error(
            "BACKEND_AUTH_SIGNING_SECRET or RIVEN_SETTING__FRONTEND_AUTH_SIGNING_SECRET environment variable is required"
        );
    }
    migrate(db, { migrationsFolder: "drizzle" });

    // @ts-expect-error ignore
    logger.box(`Riven Frontend v${__APP_VERSION__}`);
};

export const betterAuthHandler: Handle = async ({ event, resolve }) => {
    if (event.route.id?.startsWith("/(protected)")) {
        const session = await auth.api.getSession({
            headers: event.request.headers
        });

        if (session) {
            event.locals.session = session?.session;
            event.locals.user = session?.user;

            const setupComplete = await isFirstLaunchSetupComplete(
                event.locals.backendUrl,
                event.locals.apiKey,
                event.fetch
            );
            const initialSetupPhase = await isInitialSetupPhase();
            const isProtectedSetupRoute = event.route.id === "/(protected)/setup";

            if (initialSetupPhase && !setupComplete && !isProtectedSetupRoute) {
                redirect(302, "/setup");
            }

            if (!initialSetupPhase && isProtectedSetupRoute) {
                redirect(302, "/");
            }

            return svelteKitHandler({ event, resolve, auth, building });
        } else {
            redirect(302, "/auth/login");
        }
    }

    return svelteKitHandler({ event, resolve, auth, building });
};

const configureLocals: Handle = async ({ event, resolve }) => {
    event.locals.backendUrl = env.BACKEND_URL;
    event.locals.apiKey = getBackendApiKey()!;
    event.locals.backendAuthSigningSecret = getBackendAuthSigningSecret()!;

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
