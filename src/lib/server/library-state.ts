import providers from "$lib/providers";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("library-state");

// The endpoint caps the set it will look up; batch to stay under it rather
// than silently losing the tail of a long grid.
const BATCH_SIZE = 200;

interface Auth {
    baseUrl: string;
    headers: Record<string, string>;
    fetch: typeof fetch;
}

interface HasTpdbUuid {
    tpdb_uuid?: string | null;
}

/**
 * Annotate TPDB list items with what Riven knows about them.
 *
 * Poster grids need this to decide whether to offer playback, and every grid
 * in the app is built from `transformTPDBList`. Doing it per card would mean a
 * request per poster, so the whole page's ids go up in one call.
 *
 * A failure here is deliberately not fatal: the grid still renders, just
 * without play buttons.
 */
export async function attachLibraryStates<T extends HasTpdbUuid>(
    items: T[],
    auth: Auth
): Promise<(T & { riven_id: number | null; state: string | null })[]> {
    const uuids = [...new Set(items.map((item) => item.tpdb_uuid).filter(Boolean))] as string[];

    if (!uuids.length) {
        return items.map((item) => ({ ...item, riven_id: null, state: null }));
    }

    const states: Record<string, { riven_id: number; state: string }> = {};

    const batches: string[][] = [];
    for (let i = 0; i < uuids.length; i += BATCH_SIZE) {
        batches.push(uuids.slice(i, i + BATCH_SIZE));
    }

    await Promise.all(
        batches.map(async (batch) => {
            try {
                const { data, error } = await providers.riven.GET("/api/v1/items/library_states", {
                    ...auth,
                    params: { query: { tpdb_ids: batch } }
                });

                if (error) {
                    logger.error("Library state lookup failed", error);
                    return;
                }

                Object.assign(states, data?.states ?? {});
            } catch (err) {
                logger.error("Library state lookup threw", err);
            }
        })
    );

    return items.map((item) => {
        const hit = item.tpdb_uuid ? states[item.tpdb_uuid] : undefined;

        return {
            ...item,
            riven_id: hit?.riven_id ?? null,
            state: hit?.state ?? null
        };
    });
}
