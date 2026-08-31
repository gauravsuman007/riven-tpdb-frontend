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

            // No external id -- render it from the library row itself rather
            // than dropping it. An adult title TPDB has no confident match
            // for has no TMDB, TVDB or TPDB id to route by, and returning
            // null here made it vanish from the library entirely: present in
            // the database, downloaded, playable, and unreachable.
            //
            // That also made a WRONG TPDB association impossible to withdraw,
            // since detaching one would have hidden the title. The riven-id
            // route is what makes removing a bad match a safe action.
            if (!id || id === "") {
                return {
                    id: Number(item.id),
                    title: item.title,
                    poster_path: item.poster_path,
                    media_type: item.type,
                    year: extractYear(item.aired_at),
                    indexer: "riven" as const,
                    tpdb_uuid: null,
                    type: getItemType(item.type),
                    riven_id: Number(item.id),
                    state: item.state ?? null,
                    badge: stateBadge(item.state)
                };
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

    // Awaited: the search form is local work and the markup binds to it
    // immediately, so there is nothing to gain by streaming it.
    const itemsSearchForm = await superValidate(event.url.searchParams, zod4(itemsSearchSchema));

    /*
        The grid and the shelf are fetched in parallel and streamed.

        They used to run one after the other -- collections waited on the item
        query for no reason at all -- and the page waited on both. A large
        library query is the slow one, and it now fills in behind a grid of
        placeholder cards while the rest of the page is usable.

        The whole item response is one promise rather than five, because
        `items`, `page`, `totalPages` and the counts all come from the same
        call: splitting them would mean four awaits on one request.
    */
    const library = (async () => {
        const response = await providers.riven.GET("/api/v1/items", {
            params: {
                query: itemsSearchForm.data
            },
            baseUrl: event.locals.backendUrl,
            headers: {
                "x-api-key": event.locals.apiKey
            },
            fetch: event.fetch
        });

        if (response.error || !response.data) {
            // Logged and degraded rather than thrown: a rejected streamed
            // promise surfaces as an unhandled client error, and an empty
            // grid with the rest of the page intact is the better failure.
            logger.error("Failed to fetch items", response.error);

            return { items: [], page: 1, totalPages: 1, limit: 20, totalItems: 0 };
        }

        return {
            items: transformItems(response.data.items as unknown as RivenLibraryItem[]),
            page: response.data.page,
            totalPages: response.data.total_pages,
            limit: response.data.limit,
            totalItems: response.data.total_items
        };
    })();

    /*
        The user's own collections only. Source-built catalogues (AVN,
        Adult Empire) live on their own pages -- forty award years in this row
        would bury the two or three lists the user actually made.

        An addition to this page, so a failure here returns an empty shelf
        rather than taking the library down with it.
    */
    const collections = listCollections(
        {
            baseUrl: event.locals.backendUrl,
            apiKey: event.locals.apiKey,
            fetch: event.fetch
        },
        "user"
    );

    return { collections, library, itemsSearchForm };
};
