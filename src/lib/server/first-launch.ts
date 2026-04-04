import { getUsersCount } from "./functions";

export const FIRST_LAUNCH_SETUP_COOKIE = "riven_first_launch_setup";

export async function noUserExists() {
    const count = await getUsersCount();
    return count === 0;
}

export async function isInitialSetupPhase() {
    const count = await getUsersCount();
    return count <= 1;
}

export function isFirstLaunchSetupComplete(cookies: { get: (name: string) => string | undefined }) {
    return cookies.get(FIRST_LAUNCH_SETUP_COOKIE) === "true";
}
