import type { PageServerLoad } from "./$types";
import { redirect, error } from "@sveltejs/kit";
import { itemsSearchSchema } from "$lib/schemas/items";
import { zod4 } from "sveltekit-superforms/adapters";
import { superValidate } from "sveltekit-superforms";
import { gql } from "$lib/graphql-client";
import * as dateUtils from "$lib/utils/date";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("library-page-server");

const VALID_ITEM_TYPES = ["movie", "show", "season", "episode"] as const;
type ValidItemType = (typeof VALID_ITEM_TYPES)[number];
type ItemType = ValidItemType | "unknown";

interface GqlMediaItem {
    id: number;
    itemType: string;
    title: string;
    tmdbId?: string | null;
    tvdbId?: string | null;
    parentId?: number | null;
    posterPath?: string | null;
    airedAt?: string | null;
}

interface GqlItemsPage {
    items: GqlMediaItem[];
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
}

const ITEMS_QUERY = `
    query GetItems(
        $page: Int
        $limit: Int
        $sort: String
        $types: [MediaItemType!]
        $search: String
        $states: [MediaItemState!]
    ) {
        items(page: $page, limit: $limit, sort: $sort, types: $types, search: $search, states: $states) {
            items {
                id
                itemType
                title
                tmdbId
                tvdbId
                parentId
                posterPath
                airedAt
            }
            page
            limit
            totalItems
            totalPages
        }
    }
`;

function getItemType(type: string): ItemType {
    return VALID_ITEM_TYPES.includes(type as ValidItemType) ? (type as ValidItemType) : "unknown";
}

function extractYear(airedAt: string | null | undefined): number | string {
    if (!airedAt) return "N/A";
    const year = dateUtils.getYearFromISO(airedAt);
    return year ?? "N/A";
}

function transformItems(items: GqlMediaItem[]) {
    return items
        .map((item) => {
            // GraphQL serialises MediaItemType as SCREAMING_SNAKE_CASE (MOVIE, SHOW…)
            const rawType = item.itemType.toLowerCase();
            let id: string | number | null = null;
            let indexer: "tmdb" | "tvdb" = "tmdb";

            if (rawType === "movie") {
                id = item.tmdbId ?? null;
                indexer = "tmdb";
            } else if (rawType === "show") {
                id = item.tvdbId ?? null;
                indexer = "tvdb";
            } else if (rawType === "season" || rawType === "episode") {
                // For sub-items we'd need the parent's tvdb_id — skip for now
                id = item.tvdbId ?? null;
                indexer = "tvdb";
            }

            if (!id || id === "") {
                logger.warn(
                    `Skipping item "${item.title}" (id: ${item.id}, type: ${item.itemType}): missing ID`
                );
                return null;
            }

            // Details page route uses "movie" or "tv" (not "show")
            const mediaPageType = rawType === "show" ? "tv" : rawType;

            return {
                id,
                title: item.title,
                poster_path: item.posterPath,
                media_type: mediaPageType,
                year: extractYear(item.airedAt),
                indexer,
                type: getItemType(rawType),
                riven_id: item.id
            };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
}

export const load: PageServerLoad = async (event) => {
    if (!event.locals.user || !event.locals.session) {
        return redirect(302, "/auth/login");
    }

    const itemsSearchForm = await superValidate(event.url.searchParams, zod4(itemsSearchSchema));
    const { page, limit, sort, type: types, search, states } = itemsSearchForm.data;

    // Map form types to GraphQL enum values (uppercase)
    const gqlTypes = types?.map((t: string) => t.toUpperCase()) ?? undefined;
    // "All" means no filter — drop it before sending to GraphQL
    const filteredStates = states?.filter((s) => s !== "All") ?? [];
    const gqlStates = filteredStates.length > 0
        ? filteredStates.map((s) =>
            s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
             .replace(/^[a-z]/, (c: string) => c.toUpperCase())
          )
        : undefined;

    try {
        const data = await gql<{ items: GqlItemsPage }>(
            event.locals.backendUrl,
            event.locals.apiKey,
            ITEMS_QUERY,
            {
                page: page ?? 1,
                limit: limit ?? 20,
                sort: (Array.isArray(sort) ? sort[0] : sort) ?? "date_desc",
                types: gqlTypes,
                search: search ?? undefined,
                states: gqlStates
            },
            event.fetch
        );

        return {
            items: transformItems(data.items.items),
            page: data.items.page,
            totalPages: data.items.totalPages,
            limit: data.items.limit,
            totalItems: data.items.totalItems,
            itemsSearchForm
        };
    } catch (err) {
        logger.error("Failed to fetch items:", err);
        error(500, "Failed to fetch items");
    }
};
