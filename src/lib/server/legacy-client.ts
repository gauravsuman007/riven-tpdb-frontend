/**
 * Whether a request comes from a browser too old to run this app.
 *
 * The app boots by calling dynamic `import()`, which is Chromium 63, and its
 * stylesheet is Tailwind v4 output wrapped in `@layer`, which is Chromium 99.
 * Below the first of those nothing hydrates and below the second nothing is
 * styled -- so an old TV gets a bare, unstyled fragment of a page and no way
 * to tell that anything is wrong.
 *
 * The case this exists for is an LG C9: a 2019 set, so webOS 4.5, so
 * Chromium 53. LG never moves a shipped set to a newer major version, so this
 * is permanent for that hardware rather than something a firmware update
 * fixes.
 */

/** The Chromium version the app's own bootstrap needs (dynamic `import()`). */
const MINIMUM_CHROMIUM = 63;

export function isLegacyClient(userAgent: string | null): boolean {
    if (!userAgent) return false;

    const chrome = /Chrom(?:e|ium)\/(\d+)/.exec(userAgent);

    if (chrome) return Number(chrome[1]) < MINIMUM_CHROMIUM;

    /*
        A webOS build old enough to report no Chrome token at all is older
        still. Matched loosely because LG writes it as both "Web0S" (with a
        zero) and "webOS" depending on the year.
    */
    return /web0s|webos/i.test(userAgent);
}

/**
 * Whether this particular request should be sent to the TV surface.
 *
 * Only top-level page navigations. Redirecting an asset, an API call or the
 * Jellyfin protocol would break the very clients that depend on them -- the
 * webOS Jellyfin app speaks that protocol from the same old engine, so its
 * requests match `isLegacyClient` too.
 */
export function shouldRedirectToTV(pathname: string, accept: string | null): boolean {
    if (!accept?.includes("text/html")) return false;

    if (pathname === "/tv" || pathname.startsWith("/tv/")) return false;
    if (pathname.startsWith("/auth/")) return false;
    if (pathname.startsWith("/api/")) return false;
    if (pathname.startsWith("/_app/")) return false;
    if (pathname.startsWith("/web/")) return false;
    if (pathname.startsWith("/Videos/") || pathname.startsWith("/Items/")) return false;

    return true;
}
