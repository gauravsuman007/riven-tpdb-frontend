import type { RequestHandler } from "./$types";
import { parseCollectionDetails } from "$lib/metadata/parser";
import { error, json } from "@sveltejs/kit";
import { fetchTmdbCollection } from "$lib/services/backend-metadata";

export const GET: RequestHandler = async ({ fetch, params, locals }) => {
    const { id } = params;

    if (!id || isNaN(Number(id))) {
        error(400, "Invalid collection ID");
    }

    const data = await fetchTmdbCollection<Record<string, unknown>>(
        { backendUrl: locals.backendUrl, apiKey: locals.apiKey, fetch },
        Number(id)
    );

    const collection = parseCollectionDetails(data);

    return json({ collection });
};
