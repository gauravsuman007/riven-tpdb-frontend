import type { RequestHandler } from "./$types";
import { json, error } from "@sveltejs/kit";
import { gql } from "$lib/graphql-client";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("anilist-ratings");

const ANILIST_RATING_QUERY = `query($id: Int!) {
    anilistRating(id: $id) {
        id
        score
    }
}`;

interface RatingScore {
    name: string;
    image?: string;
    score: number | string | null;
}

export const GET: RequestHandler = async ({ params, fetch, locals }) => {
    const { anilistId } = params;

    const scores: RatingScore[] = [];

    try {
        const data = await gql<{
            anilistRating: {
                id: number;
                score: number | null;
            };
        }>(
            locals.backendUrl,
            locals.apiKey,
            ANILIST_RATING_QUERY,
            { id: Number(anilistId) },
            fetch
        );

        if (data.anilistRating.score) {
            scores.push({
                name: "anilist",
                image: "anilist.svg",
                score: data.anilistRating.score
            });
        }

        // Filter out null scores
        const validScores = scores.filter(
            (score) =>
                score.score !== null &&
                score.score !== "" &&
                score.score !== 0 &&
                score.score !== "0.0"
        );

        return json({
            scores: validScores,
            anilistId: Number(anilistId)
        });
    } catch (e) {
        logger.error("AniList rating fetch error:", e);
        throw error(500, "Failed to fetch AniList ratings");
    }
};
