import type { PageServerLoad } from "./$types";
import { redirect, error } from "@sveltejs/kit";
import { itemsSearchSchema } from "$lib/schemas/items";
import { zod4 } from "sveltekit-superforms/adapters";
import providers from "$lib/providers";
import { superValidate } from "sveltekit-superforms";
import * as dateUtils from "$lib/utils/date";
import { createScopedLogger } from "$lib/logger";
import { stateBadge } from "$lib/utils/item-state";
import { listCollections } from "$lib/collections";

const logger = createScopedLogger("library-page-server");

const VALID_ITEM_TYPES = ["movie", "show", "season", "episode"] as const;
type ValidItemType = (typeof VALID_ITEM_TYPES)[number];
type ItemType = ValidItemType | "unknown";

interface RivenLibraryItem {
    id: number;
    type: string;
    title: string;
    tmdb_id?: string | null;
    tvdb_id?: string | null;
    tpdb_id?: string | null;
    parent_ids?: {
        tmdb_id?: string | null;
        tvdb_id?: string | null;
        tpdb_id?: string | null;
    } | null;
    poster_path?: string | null;
    aired_at?: string | null;
    state?: string | null;
}

function getItemType(type: string): ItemType {
    return VALID_ITEM_TYPES.includes(type as ValidItemType) ? (type as ValidItemType) : "unknown";
}

function extractYear(airedAt: string | null | undefined): number | string {
    if (!airedAt) return "N/A";
    const year = dateUtils.getYearFromISO(airedAt);
    return year ?? "N/A";
}

function transformItems(items: RivenLibraryItem[]) {
    return items
        .map((item) => {
            // Determine ID and indexer for navigation
            // Movies use TMDB, Shows use TVDB (skip resolution)
            let id: string | number | null = null;
            let indexer: "tmdb" | "tvdb" | "tpdb" = "tmdb";

            // Adult items are keyed on TPDB and carry no TMDB/TVDB id at all.
            // They must be checked first, otherwise the branches below leave
            // `id` null and the item is dropped from the library entirely.
            const tpdbId = item.tpdb_id ?? item.parent_ids?.tpdb_id ?? null;

            if (tpdbId) {
                id = tpdbId;
                indexer = "tpdb";
            } else if (item.type === "movie") {
                id = item.tmdb_id ?? null;
                indexer = "tmdb";
            } else if (item.type === "show") {
                // Shows use TVDB directly - skip TMDB->TVDB resolution
                id = item.tvdb_id ?? null;
                indexer = "tvdb";
            } else if (item.type === "season" || item.type === "episode") {
                // Seasons/episodes use parent's TVDB ID
                id = item.parent_ids?.tvdb_id ?? null;
                indexer = "tvdb";
            }

            // Skip items without valid navigation IDs
            if (!id || id === "") {
                logger.warn(
                    `Skipping item "${item.title}" (riven_id: ${item.id}, type: ${item.type}): missing required ID field`
                );
                return null;
            }

            return {
                id,
                title: item.title,
                poster_path: item.poster_path,
                media_type: item.type,
                year: extractYear(item.aired_at),
                indexer,
                tpdb_uuid: tpdbId,
                type: getItemType(item.type),
                // Number(): the backend serialises this as a string, and consumers
                // (notably toGuid for the native player) need a real number.
                riven_id: Number(item.id),
                state: item.state ?? null,
                // The card renders whatever `badge` it is handed; deriving it
                // here keeps the state vocabulary in one place.
                badge: stateBadge(item.state)
            };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
}

export const load: PageServerLoad = async (event) => {
    if (!event.locals.user || !event.locals.session) {
        return redirect(302, "/auth/login");
    }

    const itemsSearchForm = await superValidate(event.url.searchParams, zod4(itemsSearchSchema));

    const itemsResponse = await providers.riven.GET("/api/v1/items", {
        params: {
            query: itemsSearchForm.data
        },
        baseUrl: event.locals.backendUrl,
        headers: {
            "x-api-key": event.locals.apiKey
        },
        fetch: event.fetch
    });

    if (itemsResponse.error) {
        error(500, "Failed to fetch items");
    }

    /*
        The user's own collections only. Source-built catalogues (AVN,
        Adult Empire) live on their own pages -- forty award years in this row
        would bury the two or three lists the user actually made.

        An addition to this page, so a failure here returns an empty shelf
        rather than taking the library down with it.
    */
    const collections = await listCollections(
        {
            baseUrl: event.locals.backendUrl,
            apiKey: event.locals.apiKey,
            fetch: event.fetch
        },
        "user"
    );

    return {
        collections,
        items: itemsResponse.data
            ? transformItems(itemsResponse.data.items as unknown as RivenLibraryItem[])
            : [],
        page: itemsResponse.data ? itemsResponse.data.page : 1,
        totalPages: itemsResponse.data ? itemsResponse.data.total_pages : 1,
        limit: itemsResponse.data ? itemsResponse.data.limit : 20,
        totalItems: itemsResponse.data ? itemsResponse.data.total_items : 0,
        itemsSearchForm
    };
};
