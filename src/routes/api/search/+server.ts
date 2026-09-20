import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { findEntities } from "$lib/entity-search";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("federated-search");

/**
 * Federated search, for the multiplexer.
 *
 * WHY THIS IS NOT UNDER `(protected)`
 *
 * The caller has no viewer. The multiplexer's own process asks, on behalf of
 * somebody who spoke at a television in front of a different app, and it
 * holds no cookie for anyone. Asked that way a protected route does NOT
 * answer 401 -- it answers with the SIGN-IN PAGE and a 200, two hundred
 * lines of HTML, which is exactly the shape of failure that gets mistaken
 * for an empty library. That is measured, not assumed: it is why riven-tv's
 * own federated search goes to the backend directly instead.
 *
 * So this sits in the public route group and uses the server's own backend
 * key, the same one every protected route uses. It is readable by anything
 * that can reach this port, which on this deployment is the LAN -- the same
 * bargain riven-tv's `/api/search` already makes, and the reason neither
 * returns anything a viewer could not see by opening the app.
 *
 * THE CONTRACT (shared with riven-tv, consumed by the multiplexer):
 *
 *     GET /api/search?q=&limit=  ->  { results: [ { title, path, ... } ] }
 *
 * Paths are BARE and app-relative, with no session and no origin: the
 * multiplexer rewrites them to `/app/riven/...` itself. Emitting an absolute
 * URL here would send the viewer out of the multiplexer's shell.
 */

interface SearchHit {
    title: string;
    path: string;
    kind?: string;
    year?: string;
    subtitle?: string;
    poster?: string;
}

/** Images are already absolute, or they are TMDB paths that need a host. */
const TMDB_IMAGES = "https://image.tmdb.org/t/p/w342";

function poster(value: unknown): string | undefined {
    const path = String(value ?? "").trim();

    if (!path) return undefined;
    if (/^https?:[/][/]/i.test(path)) return path;

    return `${TMDB_IMAGES}${path.startsWith("/") ? "" : "/"}${path}`;
}

function year(value: unknown): string | undefined {
    const match = /^([0-9]{4})/.exec(String(value ?? ""));

    return match ? match[1] : undefined;
}

interface BackendItem {
    id?: number | string;
    title?: string;
    type?: string;
    poster_path?: string | null;
    aired_at?: string | null;
}

async function libraryTitles(
    query: string,
    limit: number,
    options: { baseUrl: string; apiKey: string; fetch: typeof globalThis.fetch }
): Promise<SearchHit[]> {
    const params = new URLSearchParams({
        limit: String(limit),
        page: "1",
        sort: "date_desc",
        search: query
    });

    // Repeated keys, not comma-joined: the backend declares these as list
    // parameters, and "movie,show" arrives as one unrecognised value.
    params.append("type", "movie");
    params.append("type", "show");
    params.append("states", "All");

    const response = await options.fetch(`${options.baseUrl}/api/v1/items?${params}`, {
        headers: { accept: "application/json", "x-api-key": options.apiKey }
    });

    if (!response.ok) throw new Error(`the library answered ${response.status}`);

    const data = (await response.json()) as { items?: BackendItem[] } | null;

    return (data?.items ?? []).slice(0, limit).map((item) => {
        const type = String(item.type ?? "movie") === "show" ? "tv" : "movie";

        return {
            title: String(item.title ?? "Untitled"),
            path: `/details/media/${encodeURIComponent(String(item.id ?? ""))}/${type}`,
            kind: item.type ? String(item.type) : undefined,
            year: year(item.aired_at),
            poster: poster(item.poster_path)
        };
    });
}

export const GET: RequestHandler = async ({ url, locals, fetch }) => {
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 24, 1), 60);

    if (!query) return json({ results: [] });

    if (!locals.backendUrl || !locals.apiKey) {
        /*
            Said out loud rather than answered with an empty list. "No key
            configured" and "nothing in your library" look identical from the
            multiplexer's side, and only one of them is worth fixing.
        */
        return json({ error: "This server has no backend key, so it cannot answer a search." }, { status: 503 });
    }

    const options = { baseUrl: locals.backendUrl, apiKey: locals.apiKey, fetch };

    /*
        Titles, studios and accounts -- the same three the app's own search
        shows, so a voice search from a television and a search typed into
        the app do not disagree about what exists.

        `allSettled`: the studio directory is empty until its weekly sync has
        run and the OnlyFans add-on is optional, so one of these being
        unavailable is a normal state and must not take down a search the
        library alone could have answered.
    */
    const [titles, entities] = await Promise.allSettled([
        libraryTitles(query, limit, options),
        findEntities(query, options)
    ]);

    if (titles.status === "rejected") {
        logger.warn("federated search: the library could not be read", titles.reason);
    }

    const results: SearchHit[] = [
        ...(titles.status === "fulfilled" ? titles.value : []),
        ...(entities.status === "fulfilled"
            ? entities.value.studios.map((studio) => ({
                  title: studio.name,
                  path: `/studios/${studio.id}`,
                  kind: "Studio",
                  subtitle: studio.title_count ? `${studio.title_count} titles` : undefined,
                  poster: poster(studio.logo_path ?? studio.poster_path)
              }))
            : []),
        ...(entities.status === "fulfilled"
            ? entities.value.accounts.map((account) => ({
                  title: String(account.display_name || account.handle),
                  path: `/x/onlyfans/${encodeURIComponent(account.handle)}`,
                  kind: "OnlyFans",
                  subtitle: `@${account.handle}`,
                  poster: poster(account.avatar_url)
              }))
            : [])
    ];

    return json({ results });
};
