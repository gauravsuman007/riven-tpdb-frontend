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
        No longer marks the document when it is behind the multiplexer. It
        used to, so the UI could offer a way back to the app picker; the
        multiplexer injects that button itself now (see its inject.ts), which
        is one implementation instead of one per app and, unlike a control
        rendered by this app, is still there on an error page.
    */
    return resolve(event, {
        transformPageChunk: ({ html }) =>
            html.includes(BUNDLE_PATH)
                ? html
                : html.replace("</head>", `<script src="${BUNDLE_PATH}" defer></script></head>`)
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
 * A tiny script that paints the lock cover during HTML parsing.
 *
 * The lock is entirely client-side now (see `app-lock-guard.svelte`), and a
 * Svelte component cannot meet the one hard requirement on its own: a page
 * restored from a killed background process paints its content, THEN
 * hydrates, so the overlay would arrive a frame or two after the thing it is
 * meant to hide. Reported exactly that way -- reopen the app after a while
 * and see the library before the lock appears.
 *
 * A synchronous script in <head> runs before <body> is parsed, so the
 * attribute is on <html> before anything is laid out. Nothing here talks to
 * the server: the timeout and last-activity stamp live in localStorage, which
 * is what makes this survive the process dying.
 *
 * WHY THE LOCK IS NOT ENFORCED SERVER-SIDE ANY MORE. It used to be, with a
 * 303 to a /lock page. That is stricter, and it broke the Jellyfin clients:
 * the shell only counts itself connected when it sees a request for
 * `main.*.bundle.js` (JellyfinWebViewClient), and the standalone lock page is
 * outside the layout that emits that script tag. Redirecting to it dropped
 * the client back to "Connect to Server -- connection cannot be established",
 * losing the session. An overlay never navigates, so the page -- and the
 * client's connection to it -- stays exactly where it was.
 */
const APP_LOCK_HEAD = `<style id="app-lock-style">html[data-app-locked] body>*:not(#app-lock-overlay){visibility:hidden!important}html[data-app-locked]{background:#0b0b0f!important}</style><script>(function(){try{var s=JSON.parse(localStorage.getItem("riven.applock")||"null");if(!s||!s.enabled)return;var idle=Date.now()-(s.lastActive||0);if(idle<Math.max(1,s.timeoutMinutes||10)*60000)return;document.documentElement.setAttribute("data-app-locked","1")}catch(e){}})()<\/script>`;

const injectAppLockCover: Handle = async ({ event, resolve }) => {
    /*
        Never on the sign-in pages. The lock guard only mounts inside the
        protected layout, so an /auth page that got the attribute would hide
        its own body with nothing to unhide it -- a blank, unusable login
        screen and no way back. The sign-in page is explicitly never locked
        anyway.
    */
    if (event.url.pathname.startsWith("/auth/")) return resolve(event);

    return resolve(event, {
        transformPageChunk: ({ html }) =>
            html.includes('id="app-lock-style"')
                ? html
                : html.replace("</head>", `${APP_LOCK_HEAD}</head>`)
    });
};

export const handle: Handle = sequence(
    configureLocals,
    betterAuthHandler,
    injectAppLockCover,
    handleTVDBCookie,
    injectJellyfinBundle
);
