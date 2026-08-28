/**
 * Passwordless access for clients on a trusted network.
 *
 * This is an authentication bypass, so the rules it follows are deliberately
 * narrow:
 *
 *  - It is off unless the backend setting says otherwise, and the ranges it
 *    trusts must be written out. There is no "detect my LAN" mode; guessing
 *    wrong means guessing the library open.
 *  - It only ever grants an *existing* account. It never creates one, and the
 *    account's role still decides what that person can do.
 *  - It matches on the address SvelteKit reports for the connection. Behind a
 *    reverse proxy every request looks like it came from the proxy, which is
 *    why the setting's help text says so rather than trying to be clever with
 *    forwarded headers.
 */

import { createScopedLogger } from "$lib/logger";
import providers from "$lib/providers";
import type { LocalAccessConfig } from "$lib/utils/cidr";

export { addressInRange, isTrustedAddress } from "$lib/utils/cidr";
export type { LocalAccessConfig } from "$lib/utils/cidr";

const logger = createScopedLogger("local-access");

/**
 * Which account a trusted-network client asked to be signed in as.
 *
 * Set by the login form when someone on a trusted network submits a username
 * with an empty password. It is only ever a *selector*, never a credential:
 * every request still re-checks that the connection comes from a trusted
 * address before this is looked at, so the cookie grants nothing on its own
 * and is worthless if it leaves the network. That is what makes it safe to
 * store a plain username rather than something signed -- there is no
 * authority in it to forge.
 */
export const LOCAL_ACCOUNT_COOKIE = "riven_local_account";

const DISABLED: LocalAccessConfig = { enabled: false, networks: [], username: "" };

// The backend is the source of truth, but asking it on every single request
// would add a round trip to each page load -- the exact cost this session is
// trying to remove. A short TTL keeps a settings change taking effect within
// seconds without that.
const CONFIG_TTL_MS = 15_000;

let cached: { at: number; value: LocalAccessConfig } | null = null;

export async function loadLocalAccessConfig(
    backendUrl: string,
    apiKey: string,
    fetch: typeof globalThis.fetch
): Promise<LocalAccessConfig> {
    if (cached && Date.now() - cached.at < CONFIG_TTL_MS) return cached.value;

    try {
        const { data, error } = await providers.riven.GET("/api/v1/settings/get/{paths}", {
            baseUrl: backendUrl,
            headers: { "x-api-key": apiKey },
            fetch,
            params: { path: { paths: "local_access" } }
        });

        if (error) throw error;

        // The endpoint keys the response by the path that was asked for.
        const raw = (data as any)?.local_access ?? null;

        const value: LocalAccessConfig = raw
            ? {
                  enabled: !!raw.enabled,
                  networks: Array.isArray(raw.networks) ? raw.networks.map(String) : [],
                  username: typeof raw.username === "string" ? raw.username : ""
              }
            : DISABLED;

        cached = { at: Date.now(), value };
        return value;
    } catch (err) {
        // Fail closed. If the setting cannot be read we do not know whether the
        // bypass was meant to be on, and the safe unknown is "off".
        logger.error("Could not read local_access settings; requiring login", err);
        cached = { at: Date.now(), value: DISABLED };
        return DISABLED;
    }
}

/** Forget the cached config, so the next request re-reads it. */
export function resetLocalAccessCache(): void {
    cached = null;
}
