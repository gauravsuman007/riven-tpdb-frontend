/*
Search's other two kinds of answer: studios, and OnlyFans accounts.

WHY THIS IS SEPARATE FROM THE TITLE SEARCH

A search box is asked for three different kinds of thing and only ever
answered with one of them. Typing "brazzers" should offer the studio page as
readily as forty of its films, and typing a performer's handle should offer
their account rather than nothing at all.

These two are grouped here because they share a shape the title search does
not: both are small, local database reads that answer in milliseconds, and
both resolve to a page that already exists. Titles come from TPDB's catalogue
over the network and page in the browser, which is why they stay where they
are.

Hand-maintained rather than generated, for the same reason as `studios.ts`:
`providers/riven.ts` comes from the backend's OpenAPI spec and regenerating it
needs a running backend. The OnlyFans half is an ADD-ON's route, so it is not
in that spec at any time.

Matching is fuzzy on the backend (`program/utils/fuzzy.py`) -- "brazers" finds
Brazzers and "evilangel" finds Evil Angel -- so nothing here needs to
second-guess the spelling.
*/

import { createScopedLogger } from "$lib/logger";
import { listStudios, type Studio } from "$lib/studios";

const logger = createScopedLogger("entity-search");

/** How many of each kind a row shows. A row, not a page. */
export const PER_KIND = 12;

export interface OnlyFansAccount {
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    source_count?: number | null;
}

export interface EntityResults {
    studios: Studio[];
    accounts: OnlyFansAccount[];
}

export const NO_ENTITIES: EntityResults = { studios: [], accounts: [] };

interface Options {
    baseUrl: string;
    apiKey: string;
    fetch: typeof globalThis.fetch;
}

async function accounts(query: string, options: Options): Promise<OnlyFansAccount[]> {
    const params = new URLSearchParams({
        search: query,
        limit: String(PER_KIND)
    });

    try {
        const response = await options.fetch(
            `${options.baseUrl}/api/v1/x/onlyfans/accounts?${params}`,
            { headers: { "x-api-key": options.apiKey } }
        );

        /*
            A 404 here is the ordinary state of an installation without the
            add-on, not a fault. Logged at debug and answered with nothing, so
            search keeps working and the row simply never appears.
        */
        if (response.status === 404) return [];

        if (!response.ok) {
            logger.warn(`OnlyFans account search answered ${response.status}`);
            return [];
        }

        const body = await response.json();

        return Array.isArray(body?.items) ? body.items : [];
    } catch (error) {
        logger.warn("OnlyFans account search failed", error);
        return [];
    }
}

/**
 * Both kinds at once, and neither can fail the other.
 *
 * `allSettled` rather than `all`: the add-on is optional and the studio
 * directory is empty until its weekly sync has run, so one of these being
 * unavailable is a normal state rather than an error. A rejected `all` here
 * would take down a search that the title results alone could have answered.
 */
export async function findEntities(query: string, options: Options): Promise<EntityResults> {
    const term = (query || "").trim();

    if (!term) return NO_ENTITIES;

    const [studios, found] = await Promise.allSettled([
        listStudios(options, { search: term, limit: PER_KIND }),
        accounts(term, options)
    ]);

    return {
        studios: studios.status === "fulfilled" ? studios.value : [],
        accounts: found.status === "fulfilled" ? found.value : []
    };
}
