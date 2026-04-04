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

interface GraphQLSubscribeHandlers<T> {
    onData: (data: T) => void;
    onError?: (error: Error) => void;
}

const GRAPHQL_PROXY_URL = "/api/graphql";
const JSON_CONTENT_TYPE = "application/json";
const SUBSCRIPTION_ACCEPT_HEADER =
    'multipart/mixed; boundary="graphql"; subscriptionSpec="1.0", application/graphql-response+json';

function getGraphQLData<T>(result: GraphQLResponse<T>): T {
    if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors.map((e) => e.message).join("; "));
    }

    if (result.data === undefined) {
        throw new Error("GraphQL response contained no data");
    }

    return result.data;
}

function getMultipartBoundary(contentType: string | null): string {
    const match = contentType?.match(/boundary="?([^";]+)"?/i);
    return match?.[1] ?? "graphql";
}

function extractMultipartPayloads<T>(
    buffer: string,
    boundary: string
): { payloads: GraphQLResponse<T>[]; remainder: string } {
    const payloads: GraphQLResponse<T>[] = [];
    let cursor = 0;

    while (true) {
        const boundaryIndex = buffer.indexOf(boundary, cursor);

        if (boundaryIndex === -1) {
            return { payloads, remainder: buffer.slice(cursor) };
        }

        const afterBoundary = boundaryIndex + boundary.length;
        const nextChar = buffer.slice(afterBoundary, afterBoundary + 2);

        if (nextChar === "--") {
            return { payloads, remainder: "" };
        }

        const headerStart = buffer.startsWith("\r\n", afterBoundary)
            ? afterBoundary + 2
            : afterBoundary;
        const bodyStart = buffer.indexOf("\r\n\r\n", headerStart);

        if (bodyStart === -1) {
            return { payloads, remainder: buffer.slice(boundaryIndex) };
        }

        const payloadStart = bodyStart + 4;
        const payloadEnd = buffer.indexOf("\r\n", payloadStart);

        if (payloadEnd === -1) {
            return { payloads, remainder: buffer.slice(boundaryIndex) };
        }

        const body = buffer.slice(payloadStart, payloadEnd).trim();

        if (body && body !== "{}") {
            payloads.push(JSON.parse(body) as GraphQLResponse<T>);
        }

        cursor = payloadEnd + 2;
    }
}

async function consumeMultipartStream<T>(
    response: Response,
    onMessage: (payload: GraphQLResponse<T>) => void,
    signal?: AbortSignal
) {
    if (!response.body) {
        throw new Error("GraphQL subscription response had no body");
    }

    const boundary = `--${getMultipartBoundary(response.headers.get("content-type"))}`;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        if (signal?.aborted) {
            await reader.cancel();
            return;
        }

        const { done, value } = await reader.read();

        if (done) {
            buffer += decoder.decode();
            const { payloads } = extractMultipartPayloads<T>(buffer, boundary);
            for (const payload of payloads) {
                onMessage(payload);
            }
            return;
        }

        buffer += decoder.decode(value, { stream: true });
        const result = extractMultipartPayloads<T>(buffer, boundary);

        for (const payload of result.payloads) {
            onMessage(payload);
        }

        buffer = result.remainder;
    }
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

    return getGraphQLData(result);
}

/**
 * Execute a GraphQL operation client-side via the /api/graphql SvelteKit proxy.
 * Auth is handled transparently by the proxy route.
 */
export async function gqlClient<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await fetch(GRAPHQL_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": JSON_CONTENT_TYPE },
        body: JSON.stringify({ query, variables: variables ?? {} })
    });

    if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const result: GraphQLResponse<T> = await response.json();

    return getGraphQLData(result);
}

/**
 * Execute a client-side GraphQL subscription via multipart HTTP responses.
 * Returns an unsubscribe function that aborts the underlying request.
 */
export function gqlSubscribeClient<T>(
    query: string,
    variables: Record<string, unknown> | undefined,
    handlers: GraphQLSubscribeHandlers<T>
): () => void {
    const controller = new AbortController();
    let active = true;

    void (async () => {
        try {
            const response = await fetch(GRAPHQL_PROXY_URL, {
                method: "POST",
                headers: {
                    "Content-Type": JSON_CONTENT_TYPE,
                    Accept: SUBSCRIPTION_ACCEPT_HEADER
                },
                body: JSON.stringify({ query, variables: variables ?? {} }),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(
                    `GraphQL subscription failed: ${response.status} ${response.statusText}`
                );
            }

            await consumeMultipartStream<T>(
                response,
                (payload) => {
                    if (!active) {
                        return;
                    }

                    handlers.onData(getGraphQLData(payload));
                },
                controller.signal
            );
        } catch (error) {
            if (!active || controller.signal.aborted) {
                return;
            }

            handlers.onError?.(error instanceof Error ? error : new Error("Subscription failed"));
        }
    })();

    return () => {
        active = false;
        controller.abort();
    };
}
