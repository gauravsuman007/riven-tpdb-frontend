/**
 * A multi-file release as one timeline: where a second of the whole title
 * falls, what the whole thing runs for, and where each file begins.
 *
 * These are the numbers resume is built on. Get them wrong and a title
 * resumed on the television lands in a different scene in the browser, or a
 * five-file compilation counts as watched after its first file.
 *
 * Run: npx tsx src/lib/utils/__tests__/parts.test.ts
 */

import { decideProgress, TICKS_PER_SECOND } from "../playback";
import { locate, partStarts, totalDuration } from "../parts";

let pass = 0;
let fail = 0;

function check(name: string, condition: boolean, extra = "") {
    if (condition) {
        pass++;
        console.log(`  ok   ${name}`);
    } else {
        fail++;
        console.log(`  FAIL ${name} ${extra}`);
    }
}

// "Drive": five files, as the backend probes them.
const DRIVE = [2810.133, 2082.496, 1866.645, 2454.357, 3219.285];

check("the total is every file added up", Math.abs((totalDuration(DRIVE) ?? 0) - 12432.916) < 0.01);
check("no total when one length is unknown", totalDuration([100, null, 300]) === null);
check("no total for no files", totalDuration([]) === null);

check("0 s is the first file", locate(DRIVE, 0).part === 0 && locate(DRIVE, 0).local === 0);
check(
    "a negative or NaN position is the start",
    locate(DRIVE, -5).part === 0 && locate(DRIVE, NaN).local === 0
);

const third = locate(DRIVE, 5000);
check(
    "5000 s is 108 s into the third file",
    third.part === 2 && Math.abs(third.local - 107.371) < 0.01,
    JSON.stringify(third)
);

check(
    "a boundary belongs to the file that starts there",
    locate([100, 200, 300], 100).part === 1 && locate([100, 200, 300], 100).local === 0
);
check("the last second is the last file", locate([100, 200, 300], 599).part === 2);
check("beyond the end stays in the last file", locate([100, 200, 300], 900).part === 2);
check("past an unknown length nothing is placed further", locate([100, 0, 300], 400).part === 1);
check(
    "a single file is a timeline of one",
    locate([3600], 1234).part === 0 && locate([3600], 1234).local === 1234
);

const starts = partStarts([100, 200, 300]);
check("each file begins where the ones before it end", starts.join(",") === "0,100,300");
check(
    "after an unknown length no start is claimed",
    partStarts([100, null, 300]).join(",") === "0,100,"
);

/*
    The bug this fixes, end to end: a whole-title position against the whole
    title's length is "resume" after the first file; the old per-file report
    of the first file's own end against its own length said "finished".
*/
const total = totalDuration(DRIVE)!;
check(
    "the end of file 1, reported against the whole title, is not 'watched'",
    decideProgress(2800 * TICKS_PER_SECOND, total * TICKS_PER_SECOND).kind === "resume"
);
check(
    "the end of file 1 against file 1's own length was, which is what this replaces",
    decideProgress(2800 * TICKS_PER_SECOND, DRIVE[0] * TICKS_PER_SECOND).kind === "finished"
);
check(
    "the end of the LAST file is watched",
    decideProgress((total - 30) * TICKS_PER_SECOND, total * TICKS_PER_SECOND).kind === "finished"
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
