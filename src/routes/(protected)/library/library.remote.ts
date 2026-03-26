import { command } from "$app/server";
import { z } from "zod";
import { gql } from "$lib/graphql-client";
import { getRequestEvent } from "$app/server";

const itemIdsSchema = z.object({
    ids: z.array(z.string())
});

const RESET_MUTATION = `
    mutation ResetItems($ids: [Int!]!) {
        resetItems(ids: $ids)
    }
`;

const RETRY_MUTATION = `
    mutation RetryItems($ids: [Int!]!) {
        retryItems(ids: $ids)
    }
`;

const REMOVE_MUTATION = `
    mutation RemoveItems($ids: [Int!]!) {
        removeItems(ids: $ids)
    }
`;

export const reset_items = command(itemIdsSchema, async ({ ids }) => {
    const event = getRequestEvent();
    if (!event) throw new Error("No event found");

    const { backendUrl, apiKey } = event.locals;
    if (!backendUrl || !apiKey) throw new Error("Backend URL or API key missing");

    const numericIds = ids.map(Number).filter((n) => !isNaN(n));
    const data = await gql<{ resetItems: number }>(
        backendUrl,
        apiKey,
        RESET_MUTATION,
        { ids: numericIds }
    );

    return { success: true, count: data.resetItems };
});

export const retry_items = command(itemIdsSchema, async ({ ids }) => {
    const event = getRequestEvent();
    if (!event) throw new Error("No event found");

    const { backendUrl, apiKey } = event.locals;
    if (!backendUrl || !apiKey) throw new Error("Backend URL or API key missing");

    const numericIds = ids.map(Number).filter((n) => !isNaN(n));
    const data = await gql<{ retryItems: number }>(
        backendUrl,
        apiKey,
        RETRY_MUTATION,
        { ids: numericIds }
    );

    return { success: true, count: data.retryItems };
});

export const remove_items = command(itemIdsSchema, async ({ ids }) => {
    const event = getRequestEvent();
    if (!event) throw new Error("No event found");

    const { backendUrl, apiKey } = event.locals;
    if (!backendUrl || !apiKey) throw new Error("Backend URL or API key missing");

    const numericIds = ids.map(Number).filter((n) => !isNaN(n));
    const data = await gql<{ removeItems: number }>(
        backendUrl,
        apiKey,
        REMOVE_MUTATION,
        { ids: numericIds }
    );

    return { success: true, count: data.removeItems };
});
