/**
 * "Up next": the home hero, chosen rather than listed. One implementation,
 * read by two surfaces -- this app's home page and riven-tv's, which asks
 * `/api/playback/up-next` -- so the television and the browser can never
 * disagree about what to put on next. A copy per surface is how riven-tv's
 * site-tier table drifted from the backend's; this logic lives only here.
 *
 * In order, and each card says which of these put it there:
 *
 *   1. CONTINUE WATCHING -- anything started and not finished, newest first.
 *   2. BECAUSE YOU WATCHED X -- unwatched titles sharing performers or a
 *      studio with the last thing watched. Shared tags break ties; tags alone
 *      never qualify, because a tag like "lingerie" is shared by half a
 *      library and recommends nothing.
 *   3. AWARD-WINNING -- one unwatched title tagged with an award.
 *   4. NOT WATCHED YET -- unwatched titles OLDER than the Recently Added row,
 *      so the hero never repeats it, rotated once a day.
 *
 * History is `playback_progress`, the store the web player and the Jellyfin
 * clients already write. This file is the pure part, so `__tests__/up-next.test.ts` can pin
 * every rule; `$lib/server/up-next` is the part that fetches.
 */

export interface Watched {
    itemId: number;
    positionSeconds: number;
    durationSeconds: number | null;
    played: boolean;
    updatedAt: string;
}

export interface LibraryItem {
    id: number | string;
    tpdb_id?: string | null;
    parent_ids?: { tpdb_id?: string | null } | null;
    title?: string | null;
    poster_path?: string | null;
    aired_at?: string | null;
    requested_at?: string | null;
    site_name?: string | null;
    performers?: string[] | null;
    genres?: string[] | null;
    state?: string | null;
}

export interface UpNextCard {
    item: LibraryItem;
    /** Why it is here, in a few words: the kicker above the title. */
    reason: string;
    /** One muted line under the title. */
    detail: string;
    /** 0..1, only for something to resume. */
    progress?: number;
    /** Seconds to resume at, only for something to resume. */
    resumeAt?: number;
}

/** How many of the newest titles the Recently Added row already shows. */
export const RECENT_SHOWN = 12;

const AWARD = /award/i;

function idOf(item: LibraryItem): number {
    return Number(item.id) || 0;
}

function lower(values: string[] | null | undefined): string[] {
    return (values ?? []).map((value) => String(value).toLowerCase());
}

function clock(seconds: number): string {
    const whole = Math.max(0, Math.floor(seconds));
    const h = Math.floor(whole / 3600);
    const m = Math.floor((whole % 3600) / 60);
    const s = whole % 60;

    return h > 0
        ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
        : `${m}:${String(s).padStart(2, "0")}`;
}

/** A stable, day-dependent order: the same all evening, different tomorrow. */
function shuffleKey(day: string, id: number): number {
    let hash = 2166136261;
    const text = `${day}:${id}`;

    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}

function ago(iso: string | null | undefined, now: number): string {
    const then = Date.parse(String(iso ?? ""));

    if (!Number.isFinite(then)) return "Not watched yet";

    const days = Math.floor((now - then) / 86_400_000);

    if (days < 1) return "Added today, not watched yet";
    if (days < 14) return `Added ${days} day${days === 1 ? "" : "s"} ago, not watched yet`;
    if (days < 60) return `In your library for ${Math.floor(days / 7)} weeks`;

    return `In your library for ${Math.floor(days / 30)} months`;
}

/**
 * Why `candidate` follows from `seed`, or null when it does not.
 *
 * Performers weigh most: they are what a viewer of this library means by
 * "more like that". A studio is a style. Tags only order what already
 * qualified.
 */
function likeness(
    seed: LibraryItem,
    candidate: LibraryItem
): { score: number; why: string } | null {
    const seedCast = new Set(lower(seed.performers));
    const shared = (candidate.performers ?? []).filter((name) =>
        seedCast.has(String(name).toLowerCase())
    );
    const sameStudio =
        Boolean(seed.site_name) &&
        String(seed.site_name).toLowerCase() === String(candidate.site_name ?? "").toLowerCase();

    if (shared.length === 0 && !sameStudio) return null;

    const seedTags = new Set(lower(seed.genres));
    const tags = lower(candidate.genres).filter((tag) => seedTags.has(tag)).length;

    return {
        score: shared.length * 3 + (sameStudio ? 2 : 0) + Math.min(tags, 6) * 0.25,
        why: shared.length
            ? `Also with ${shared.slice(0, 2).join(" and ")}`
            : `Also from ${String(candidate.site_name)}`
    };
}

export function upNext(
    library: LibraryItem[],
    watched: Watched[],
    options: { now?: number; limit?: number } = {}
): UpNextCard[] {
    const now = options.now ?? Date.now();
    const limit = options.limit ?? 5;
    const day = new Date(now).toISOString().slice(0, 10);

    const byId = new Map<number, LibraryItem>();

    for (const item of library) {
        if (idOf(item) > 0 && item.title) byId.set(idOf(item), item);
    }

    // Newest first, and only for titles still in the library.
    const history = watched
        .filter((row) => byId.has(row.itemId))
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    const seen = new Set(history.map((row) => row.itemId));

    const cards: UpNextCard[] = [];
    const taken = new Set<number>();
    const add = (card: UpNextCard): void => {
        if (cards.length >= limit || taken.has(idOf(card.item))) return;
        taken.add(idOf(card.item));
        cards.push(card);
    };

    // 1. Continue watching -- at most two, so the strip is not all resumes.
    for (const row of history.filter((r) => !r.played && r.positionSeconds > 0).slice(0, 2)) {
        const length =
            row.durationSeconds && row.durationSeconds > row.positionSeconds
                ? row.durationSeconds
                : 0;

        add({
            item: byId.get(row.itemId) as LibraryItem,
            reason: "Continue watching",
            detail: length
                ? `${Math.max(1, Math.round((length - row.positionSeconds) / 60))} min left`
                : `Stopped at ${clock(row.positionSeconds)}`,
            progress: length ? row.positionSeconds / length : undefined,
            resumeAt: Math.floor(row.positionSeconds)
        });
    }

    const unwatched = [...byId.values()].filter((item) => !seen.has(idOf(item)));

    // 2. Because you watched the most recent thing.
    const seed = history[0] ? byId.get(history[0].itemId) : undefined;

    if (seed) {
        const ranked = unwatched
            .map((item) => ({ item, like: likeness(seed, item) }))
            .filter(
                (entry): entry is { item: LibraryItem; like: { score: number; why: string } } =>
                    entry.like !== null
            )
            .sort((a, b) => b.like.score - a.like.score);

        for (const { item, like } of ranked.slice(0, 2)) {
            add({ item, reason: `Because you watched ${seed.title}`, detail: like.why });
        }
    }

    // 3. One award-winner nobody has watched.
    const award = unwatched
        .filter(
            (item) =>
                !taken.has(idOf(item)) && (item.genres ?? []).some((tag) => AWARD.test(String(tag)))
        )
        .sort((a, b) => shuffleKey(day, idOf(a)) - shuffleKey(day, idOf(b)))[0];

    if (award)
        add({ item: award, reason: "Award-winning", detail: "In your library, not watched yet" });

    // 4. The rest of the unwatched library, minus what Recently Added shows.
    // The library arrives newest first, which is the order that row uses.
    const newest = new Set([...byId.keys()].slice(0, RECENT_SHOWN));

    const rest = unwatched
        .filter((item) => !newest.has(idOf(item)) && !taken.has(idOf(item)))
        .sort((a, b) => shuffleKey(day, idOf(a)) - shuffleKey(day, idOf(b)));

    for (const item of rest)
        add({ item, reason: "Not watched yet", detail: ago(item.requested_at, now) });

    return cards;
}
