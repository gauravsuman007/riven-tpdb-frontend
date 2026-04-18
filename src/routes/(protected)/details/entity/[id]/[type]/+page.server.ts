import type { PageServerLoad } from "./$types";
import { parsePersonDetails, parseCompanyDetails } from "$lib/metadata/parser";
import { error } from "@sveltejs/kit";
import { fetchTmdbDetails, mapGqlTmdbList, searchTmdb } from "$lib/services/backend-metadata";

export const load: PageServerLoad = async ({ fetch, params, locals }) => {
    const { id, type } = params;

    if (!id || isNaN(Number(id))) {
        error(400, "Invalid ID");
    }

    if (type === "person") {
        const data = await fetchTmdbDetails<Record<string, unknown>>(
            { backendUrl: locals.backendUrl, apiKey: locals.apiKey, fetch },
            {
                type: "person",
                id: Number(id),
                appendToResponse: "combined_credits,external_ids"
            }
        );

        return {
            entity: parsePersonDetails(data)
        };
    } else if (type === "company") {
        const [companyRes, moviesRes, showsRes] = await Promise.all([
            fetchTmdbDetails<Record<string, unknown>>(
                { backendUrl: locals.backendUrl, apiKey: locals.apiKey, fetch },
                { type: "company", id: Number(id) }
            ),
            searchTmdb(
                { backendUrl: locals.backendUrl, apiKey: locals.apiKey, fetch },
                {
                    type: "movie",
                    params: { with_companies: String(id), sort_by: "popularity.desc" },
                    searchMode: "discover"
                }
            ),
            searchTmdb(
                { backendUrl: locals.backendUrl, apiKey: locals.apiKey, fetch },
                {
                    type: "tv",
                    params: { with_companies: String(id), sort_by: "popularity.desc" },
                    searchMode: "discover"
                }
            )
        ]);
        const movies = mapGqlTmdbList(moviesRes);
        const shows = mapGqlTmdbList(showsRes);

        return {
            entity: parseCompanyDetails(companyRes, movies, shows)
        };
    } else {
        error(404, "Invalid entity type");
    }
};
