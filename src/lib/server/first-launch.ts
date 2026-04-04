import { gql } from "$lib/graphql-client";
import { getUsersCount } from "./functions";

const INSTANCE_STATUS_QUERY = `query { instanceStatus { setupCompleted } }`;
const COMPLETE_INITIAL_SETUP = `mutation { completeInitialSetup }`;

export async function noUserExists() {
    const count = await getUsersCount();
    return count === 0;
}

export async function isInitialSetupPhase() {
    const count = await getUsersCount();
    return count <= 1;
}

export async function isFirstLaunchSetupComplete(
    backendUrl: string,
    apiKey: string,
    fetchFn: typeof fetch
) {
    const result = await gql<{ instanceStatus: { setupCompleted: boolean } }>(
        backendUrl,
        apiKey,
        INSTANCE_STATUS_QUERY,
        {},
        fetchFn
    ).catch(() => ({ instanceStatus: { setupCompleted: false } }));

    return result.instanceStatus.setupCompleted === true;
}

export async function markFirstLaunchSetupComplete(
    backendUrl: string,
    apiKey: string,
    fetchFn: typeof fetch
) {
    await gql(backendUrl, apiKey, COMPLETE_INITIAL_SETUP, {}, fetchFn);
}
