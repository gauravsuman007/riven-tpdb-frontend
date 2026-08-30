import { auth } from "$lib/server/auth";
import { redirect, error, type Handle, type ServerInit } from "@sveltejs/kit";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";
import { sequence } from "@sveltejs/kit/hooks";
import { isLocked } from "$lib/server/app-lock";
import { env } from "$env/dynamic/private";
import providers from "$lib/providers";
import { dev } from "$app/environment";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "$lib/server/db";
import { user } from "$lib/server/schema";
import { eq, or } from "drizzle-orm";
import { createCustomFetch } from "$lib/custom-fetch";
import { createScopedLogger } from "$lib/logger";
import {
    LOCAL_ACCOUNT_COOKIE,
    isTrustedAddress,
    loadLocalAccessConfig
} from "$lib/server/local-access";
import { BUNDLE_PATH } from "$lib/server/jellyfin/bundle";
import { jellyfinEnabled } from "$lib/server/jellyfin/config";

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
    const byName = (name: string) =>
        db
            .select()
            .from(user)
            .where(or(eq(user.username, name), eq(user.name, name), eq(user.email, name)))
            .get();

    // A device that signed in through the login form with an empty password
    // picked its own account; honour that over the configured default. The
    // cookie is only a selector -- we are already past the trusted-address
    // check above, and it is re-run on every request, so this cannot be used
    // to reach anything from off the network.
    const requested = event.cookies.get(LOCAL_ACCOUNT_COOKIE);

    const account = requested
        ? byName(requested)
        : config.username
          ? byName(config.username)
          : // No name configured: the oldest admin, so which account gets
            // picked does not change as users are added.
            db.select().from(user).where(eq(user.role, "admin")).orderBy(user.createdAt).get();

    if (!account) {
        logger.error(
            `Local access is enabled for ${address} but no account matches ` +
                (requested
                    ? `the requested "${requested}"`
                    : config.username
                      ? `"${config.username}"`
                      : "the admin role") +
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

/**
 * Give the Jellyfin WebView shells (official Android app, LG webOS) something
 * to "connect" to. `JellyfinWebViewClient.shouldInterceptRequest()` marks the
 * client connected the instant it sees a REQUEST PATH matching
 * "main.<anything>.bundle.js" -- it never reads the response -- so every
 * HTML page needs to reference that path or the shell sits on a spinner for
 * 10s and reports the server unreachable. See `lib/server/jellyfin/bundle.ts`.
 *
 * Harmless for a normal browser: the script is inert unless
 * `window.NativePlayer` exists.
 */
const injectJellyfinBundle: Handle = async ({ event, resolve }) => {
    if (!jellyfinEnabled()) return resolve(event);

    /*
        `x-multiplexer-app` is set by jellyfin-client-multiplexer on every
        request it proxies. Marked on <html> so the UI can offer a way back to
        the app picker -- inside the Jellyfin client there is no address bar
        and no other way out.
    */
    const viaMultiplexer = event.request.headers.has("x-multiplexer-app");

    return resolve(event, {
        transformPageChunk: ({ html }) => {
            const withBundle = html.includes(BUNDLE_PATH)
                ? html
                : html.replace("</head>", `<script src="${BUNDLE_PATH}" defer></script></head>`);

            return viaMultiplexer
                ? withBundle.replace("<html", '<html data-multiplexer="1"')
                : withBundle;
        }
    });
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


/**
 * Send a locked session to the lock screen BEFORE any page load runs.
 *
 * This is what makes the lock leak-proof, and why it is a hook rather than a
 * check inside a layout. A layout that renders a lock over its children has
 * still loaded and shipped those children: the data sits in the DOM and in
 * the flight of `__data.json`, one devtools panel -- or one slow paint --
 * away from being read. Redirecting here means a locked browser is never
 * sent the content at all.
 *
 * The exemptions are the paths that have to keep working while locked:
 * `/lock` itself and the unlock endpoint, the auth pages (the login screen is
 * explicitly never locked), sign-out, and the Jellyfin surface -- a native
 * player mid-stream authenticates with a token, not this session, and
 * interrupting it would stop playback on a device nobody is holding.
 */
const enforceAppLock: Handle = async ({ event, resolve }) => {
    const path = event.url.pathname;

    const exempt =
        path === "/lock" ||
        path.startsWith("/api/lock/") ||
        path.startsWith("/auth/") ||
        path.startsWith("/direct-play/") ||
        path.startsWith("/web/") ||
        path.startsWith("/Items") ||
        path.startsWith("/Videos") ||
        path.startsWith("/Sessions") ||
        path.startsWith("/Users") ||
        path.startsWith("/System");

    if (exempt || !event.locals.user || !isLocked(event.locals.user.id)) {
        return resolve(event);
    }

    /*
        A data request is answered with a redirect too, not just a page one.
        SvelteKit fetches `__data.json` for client-side navigations, and
        letting those through would hand the content to a locked tab while
        the visible page showed the lock.
    */
    const next = event.url.pathname + event.url.search;

    redirect(303, `/lock?next=${encodeURIComponent(next)}`);
};

export const handle: Handle = sequence(
    configureLocals,
    betterAuthHandler,
    // After auth (it needs locals.user) and before anything that renders.
    enforceAppLock,
    handleTVDBCookie,
    injectJellyfinBundle
);
