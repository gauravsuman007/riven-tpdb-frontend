/**
 * Configuration for the Jellyfin-compatible surface.
 *
 * Deliberately env-driven rather than stored in Riven's own settings.json:
 * this now lives in the frontend, which has no settings-form infrastructure
 * of its own, and these values change rarely enough that a restart to pick
 * up a new one is a reasonable cost.
 *
 * There is no password field on purpose, matching the backend's former
 * design: the password is `BACKEND_API_KEY` (the same secret every other
 * admin call already uses), so this exposes no second credential and cannot
 * grant access the existing API would refuse.
 */

import { env } from "$env/dynamic/private";

export function jellyfinEnabled(): boolean {
    return env.JELLYFIN_ENABLED === "true";
}

export function jellyfinServerName(): string {
    return env.JELLYFIN_SERVER_NAME || "Riven";
}

export function jellyfinUsername(): string {
    return env.JELLYFIN_USERNAME || "riven";
}
