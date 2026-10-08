/**
 * The rules that choose "Up next", for this app's home hero and riven-tv's.
 *
 * Each one is a thing a viewer would notice being broken: a finished film
 * offered to resume, a recommendation that is a title already watched, a
 * hero that repeats the Recently Added row under it.
 *
 * Run with: npx tsx src/lib/utils/__tests__/up-next.test.ts
 */

import { upNext, RECENT_SHOWN } from "../up-next";

let pass = 0;
let fail = 0;

function check(condition: boolean, name: string) {
    if (condition) {
        pass++;
        console.log(`  ok   ${name}`);
    } else {
        fail++;
        console.log(`  FAIL ${name}`);
    }
}

const NOW = Date.parse("2026-10-08T20:00:00Z");

// Newest first, as the library is fetched: ids 100..61.
const library = Array.from({ length: 40 }, (_, i) => ({
    id: 100 - i,
    title: `Title ${100 - i}`,
    site_name: i % 2 ? "Studio A" : "Studio B",
    performers: [`P${i % 7}`],
    genres: i === 30 ? ["avn awards"] : ["tag"],
    requested_at: "2026-08-01T00:00:00Z"
}));

const at = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

/* --- no history: never the newest, never empty ---------------------- */

const fresh = upNext(library, [], { now: NOW });
const newest = new Set<number | string>(library.slice(0, RECENT_SHOWN).map((item) => item.id));

check(fresh.length === 5, "with no history the strip still fills from the unwatched library");
check(
    fresh.every((card) => !newest.has(card.item.id)),
    "it never repeats the titles the Recently Added row already shows"
);
check(
    fresh.some((card) => card.reason === "Award-winning" && card.item.id === 70),
    "an unwatched award-winner earns a card"
);
check(
    !fresh.some((card) => card.reason === "Continue watching"),
    "nothing to resume is not invented"
);

const tomorrow = upNext(library, [], { now: NOW + 86_400_000 });
check(
    JSON.stringify(tomorrow.map((c) => c.item.id)) !== JSON.stringify(fresh.map((c) => c.item.id)),
    "the unwatched picks rotate from one day to the next"
);
check(
    JSON.stringify(upNext(library, [], { now: NOW + 3_600_000 }).map((c) => c.item.id)) ===
        JSON.stringify(fresh.map((c) => c.item.id)),
    "but hold still within a day, so the strip is the same all evening"
);

/* --- with history ----------------------------------------------------- */

const history = [
    { itemId: 90, positionSeconds: 1200, durationSeconds: 3600, played: false, updatedAt: at(10) },
    { itemId: 80, positionSeconds: 3500, durationSeconds: 3600, played: true, updatedAt: at(60) },
    { itemId: 99, positionSeconds: 0, durationSeconds: null, played: true, updatedAt: at(5) }
];

const cards = upNext(library, history, { now: NOW });

check(
    cards[0].reason === "Continue watching" && cards[0].item.id === 90,
    "the unfinished film leads"
);
check(
    cards[0].resumeAt === 1200 && cards[0].detail === "40 min left",
    "it resumes at the saved second and says what is left"
);
check(Math.abs((cards[0].progress ?? 0) - 1 / 3) < 0.01, "and draws how far in it is");
check(
    !cards.some((card) => card.item.id === 80 || card.item.id === 99),
    "a finished title is never recommended or resumed"
);

const because = cards.filter((card) => card.reason.startsWith("Because you watched"));
check(
    because.length > 0 && because[0].reason === "Because you watched Title 99",
    "recommendations follow the LAST thing watched"
);
check(
    because.every(
        (card) => card.item.performers?.[0] === "P1" || card.item.site_name === "Studio A"
    ),
    "a recommendation shares a performer or a studio with it -- tags alone never qualify"
);
check(
    because.every((card) => /^Also (with|from) /.test(card.detail)),
    "and says which"
);

/* --- edges ------------------------------------------------------------ */

check(
    upNext([], history, { now: NOW }).length === 0,
    "an empty library is an empty strip, not an error"
);
check(
    upNext(
        library,
        [
            {
                itemId: 9999,
                positionSeconds: 50,
                durationSeconds: 100,
                played: false,
                updatedAt: at(1)
            }
        ],
        { now: NOW }
    ).every((card) => card.reason !== "Continue watching"),
    "history about a title no longer in the library is ignored"
);
check(new Set(cards.map((card) => card.item.id)).size === cards.length, "no title appears twice");

console.log(`\n${pass} passed, ${fail} failed`);

if (fail > 0) process.exit(1);
