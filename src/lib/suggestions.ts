/*
Library search suggestions.

Hand-typed for the same reason as `collections.ts`: `providers/riven.ts` is
generated from the backend's OpenAPI spec and regenerating it needs a running
backend. The shape below is maintained against `routers/secure/items.py`
(`suggest_items`).

The endpoint answers from the LIBRARY only. It never reaches TPDB, so typing
in the search box cannot become a rate-limited upstream call per keystroke.
*/

import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("suggestions");

export interface Suggestion {
    value: string;
    /** How many library titles this suggestion matches. */
    count: number;
}

export interface Suggestions {
    titles: Suggestion[];
    studios: Suggestion[];
    performers: Suggestion[];
}

export const EMPTY_SUGGESTIONS: Suggestions = { titles: [], studios: [], performers: [] };

interface FetchOptions {
    baseUrl: string;
    apiKey: string;
    fetch: typeof globalThis.fetch;
}

/**
 * Titles, studios and cast matching a partial query.
 *
 * Returns empty groups rather than throwing: a dropdown that fails to appear
 * is a far better failure than a search box that throws while being typed in.
 */
export async function getSuggestions(
    q: string,
    { baseUrl, apiKey, fetch }: FetchOptions,
    limit = 5
): Promise<Suggestions> {
    const query = new URLSearchParams({ q, limit: String(limit) });

    try {
        const response = await fetch(`${baseUrl}/api/v1/items/suggest?${query}`, {
            headers: { "x-api-key": apiKey }
        });

        if (!response.ok) {
            logger.error(`suggest failed: ${response.status}`);
            return EMPTY_SUGGESTIONS;
        }

        const data = (await response.json()) as Partial<Suggestions>;

        return {
            titles: data.titles ?? [],
            studios: data.studios ?? [],
            performers: data.performers ?? []
        };
    } catch (err) {
        logger.error(`suggest threw: ${err}`);
        return EMPTY_SUGGESTIONS;
    }
}
