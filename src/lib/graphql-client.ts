/**
 * Minimal GraphQL client for communicating with the Rust backend.
 *
 * Server-side usage (in load functions / server routes):
 *   import { gql } from '$lib/graphql-client';
 *   const data = await gql<{ stats: Stats }>(locals.backendUrl, locals.apiKey, QUERY, vars, fetch);
 *
 * Client-side usage (in Svelte components):
 *   import { gqlClient } from '$lib/graphql-client';
 *   const data = await gqlClient<{ removeItems: number }>(MUTATION, vars);
 */

interface GraphQLResponse<T> {
    data?: T;
    errors?: Array<{ message: string; locations?: unknown; path?: unknown }>;
}

/**
 * Execute a GraphQL operation against the backend, adding the x-api-key header.
 * Use this server-side where you have access to backendUrl and apiKey.
 */
export async function gql<T>(
    backendUrl: string,
    apiKey: string,
    query: string,
    variables?: Record<string, unknown>,
    fetchFn: typeof fetch = fetch
): Promise<T> {
    const response = await fetchFn(`${backendUrl}/graphql`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey
        },
        body: JSON.stringify({ query, variables: variables ?? {} })
    });

    if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const result: GraphQLResponse<T> = await response.json();

    if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors.map((e) => e.message).join("; "));
    }

    if (result.data === undefined) {
        throw new Error("GraphQL response contained no data");
    }

    return result.data;
}

/**
 * Execute a GraphQL operation client-side via the /api/graphql SvelteKit proxy.
 * Auth is handled transparently by the proxy route.
 */
export async function gqlClient<T>(
    query: string,
    variables?: Record<string, unknown>
): Promise<T> {
    const response = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: variables ?? {} })
    });

    if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const result: GraphQLResponse<T> = await response.json();

    if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors.map((e) => e.message).join("; "));
    }

    if (result.data === undefined) {
        throw new Error("GraphQL response contained no data");
    }

    return result.data;
}
