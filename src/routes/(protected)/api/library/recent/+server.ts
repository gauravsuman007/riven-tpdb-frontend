import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { gql } from "$lib/graphql-client";

const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

const RECENT_QUERY = `
    query RecentItems($page: Int, $limit: Int, $sort: String, $types: [MediaItemType!]) {
        items(page: $page, limit: $limit, sort: $sort, types: $types) {
            items {
                id
                itemType
                title
                tmdbId
                tvdbId
                posterPath
                airedAt
                year
            }
            page
            totalPages
            totalItems
        }
    }
`;

interface GqlItem {
    id: number;
    itemType: string;
    title: string;
    tmdbId?: string | null;
    tvdbId?: string | null;
    posterPath?: string | null;
    airedAt?: string | null;
    year?: number | null;
}

export const GET: RequestHandler = async ({ locals, url }) => {
    const page = Number(url.searchParams.get("page") || "1");

    try {
        const data = await gql<{
            items: {
                items: GqlItem[];
                page: number;
                totalPages: number;
                totalItems: number;
            };
        }>(locals.backendUrl, locals.apiKey, RECENT_QUERY, {
            page,
            limit: 15,
            sort: "date_desc",
            types: ["MOVIE", "SHOW"]
        });

        const items = data.items.items.map((item) => {
            const hasAbsolutePoster = item.posterPath?.startsWith("http");

            let id: string | number;
            let indexer: string;

            if (item.tmdbId) {
                id = parseInt(item.tmdbId, 10);
                indexer = "tmdb";
            } else if (item.tvdbId) {
                id = parseInt(item.tvdbId, 10);
                indexer = "tvdb";
            } else {
                id = item.id;
                indexer = "riven";
            }

            return {
                id,
                indexer,
                title: item.title,
                poster_path: item.posterPath
                    ? hasAbsolutePoster
                        ? item.posterPath
                        : `${TMDB_IMAGE_BASE_URL}/w500${item.posterPath}`
                    : null,
                media_type: item.itemType.toLowerCase() === "show" ? "tv" : item.itemType.toLowerCase(),
                year: item.year || (item.airedAt ? new Date(item.airedAt).getFullYear() : "N/A"),
                riven_id: item.id
            };
        });

        return json({
            items,
            page: data.items.page,
            total_pages: data.items.totalPages,
            total_results: data.items.totalItems
        });
    } catch (err) {
        console.error("Error fetching recent items:", err);
        const message = err instanceof Error ? err.message : String(err);
        throw error(500, `Failed to fetch recent items: ${message}`);
    }
};
