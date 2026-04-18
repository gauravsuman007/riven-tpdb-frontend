import type { RequestHandler } from "./$types";
import { json, error } from "@sveltejs/kit";
import { gql } from "$lib/graphql-client";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("anilist-trending");

const TRENDING_ANILIST_QUERY = `query($page: Int!, $perPage: Int) {
    trendingAnilist(page: $page, perPage: $perPage) {
        results {
            id
            title
            posterPath
            mediaType
            year
        }
    }
}`;

export const GET: RequestHandler = async ({ fetch, locals, url }) => {
    if (!locals.user || !locals.session) {
        error(401, "Unauthorized");
    }

    const page = parseInt(url.searchParams.get("page") || "1");

    try {
        const data = await gql<{
            trendingAnilist: {
                results: Array<{
                    id: number;
                    title: string;
                    posterPath: string | null;
                    mediaType: string;
                    year: string;
                }>;
            };
        }>(locals.backendUrl, locals.apiKey, TRENDING_ANILIST_QUERY, { page, perPage: 20 }, fetch);

        return json({
            results: data.trendingAnilist.results.map((item) => ({
                id: item.id,
                title: item.title,
                poster_path: item.posterPath,
                media_type: item.mediaType,
                year: item.year
            }))
        });
    } catch (err) {
        logger.error("Error fetching anilist trending data:", err);
        error(500, "Failed to fetch anilist trending data");
    }
};
