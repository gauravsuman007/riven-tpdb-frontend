/**
 * A title's cast, most important first.
 *
 * No source has a billing order. TPDB lists women A-Z then men A-Z, and Adult
 * Empire's "Starring" line is alphabetical too (checked on After Dark: Abella
 * Danger, Adriana Chechik, Ana Foxxx...). So importance is inferred from what
 * the record itself says, strongest signal first:
 *
 *   1. named in the title ("Angela White: Dark Side")
 *   2. named in the description -- full name, or a first name no one else in
 *      the cast shares ("The last night of freedom is upon Tori")
 *   3. how many of the movie's scenes they appear in, when TPDB links them
 *   4. then women before men, which is how the industry bills
 *   5. then TPDB's performer rating, then TPDB's own order
 *
 * Checked on the library: After Dark leads with Tori Black and Drive with
 * Maitland Ward, the leads both films were awarded for.
 *
 * A director who also performs is not promoted by "directed by" in the
 * description: that mention is about directing.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function count(haystack: string, needle: string): number {
    if (!needle) return 0;
    return haystack.match(new RegExp(`\\b${escape(needle)}\\b`, "g"))?.length ?? 0;
}

export function castOrder(record: Json): Json[] {
    const cast = ((record.performers ?? []) as Json[]).filter((p) => p?.name);
    const title = String(record.title ?? "").toLowerCase();
    const directors = new Set(
        ((record.directors ?? []) as Json[]).map((d) => String(d?.name ?? "").toLowerCase())
    );
    const description = String(record.description ?? "").toLowerCase();

    const canonical = (p: Json) => String(p.parent?.id ?? p.id ?? p.name);
    const scenes = new Map<string, number>();

    for (const scene of (record.scenes ?? []) as Json[]) {
        const present = new Set(((scene?.performers ?? []) as Json[]).map(canonical));
        for (const id of present) scenes.set(id, (scenes.get(id) ?? 0) + 1);
    }

    const firstNames = new Map<string, number>();
    for (const p of cast) {
        const first = String(p.name).split(/\s+/)[0].toLowerCase();
        firstNames.set(first, (firstNames.get(first) ?? 0) + 1);
    }

    const scored = cast.map((p, index) => {
        const name = String(p.name).toLowerCase();
        const first = name.split(/\s+/)[0];
        let score = 0;

        if (title.includes(name)) score += 100;

        let full = count(description, name);
        // "Written and directed by Kayden Kross" is about the directing.
        if (directors.has(name)) full = Math.max(0, full - 1);
        score += 20 * full;

        // A first name only counts when it is unambiguous, and the full-name
        // mentions already counted are not counted again.
        if (first.length > 2 && firstNames.get(first) === 1) {
            score += 10 * Math.max(0, count(description, first) - count(description, name));
        }

        score += 5 * (scenes.get(canonical(p)) ?? 0);

        const gender = p.parent?.extras?.gender ?? p.extra?.gender ?? p.extras?.gender;
        const rating = Number(p.parent?.rating ?? p.rating ?? 0) || 0;

        return { p, index, score, female: gender === "Female" ? 1 : 0, rating };
    });

    scored.sort(
        (a, b) =>
            b.score - a.score || b.female - a.female || b.rating - a.rating || a.index - b.index
    );

    return scored.map((entry) => entry.p);
}
