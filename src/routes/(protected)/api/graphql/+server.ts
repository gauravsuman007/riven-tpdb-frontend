/**
 * Server-side proxy for client-side GraphQL requests.
 * Adds the x-api-key auth header before forwarding to the Rust backend.
 */
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ locals, request }) => {
    const body = await request.text();

    try {
        const response = await fetch(`${locals.backendUrl}/graphql`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": locals.apiKey
            },
            body
        });

        const data = await response.json();
        return json(data, { status: response.status });
    } catch {
        throw error(500, "Failed to reach GraphQL backend");
    }
};
