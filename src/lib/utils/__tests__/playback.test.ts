/**
 * Tests for what a reported playback position means.
 *
 * These rules decide whether something is "watched" and whether it is worth
 * resuming, and both are easy to get subtly wrong in ways nobody notices for
 * weeks: an item stuck at 99% that offers a two-second resume, a title that
 * un-finishes itself every time it is replayed, or a Continue Watching row
 * full of things opened for four seconds. The cases below are those.
 */

import {
    MIN_RESUME_SECONDS,
    TICKS_PER_SECOND,
    decideProgress,
    resumeTarget
} from "../playback";

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

const seconds = (n: number) => n * TICKS_PER_SECOND;

console.log("decideProgress");

{
    const d = decideProgress(seconds(300), seconds(3600));
    check(
        "stores a position past the early-abandon threshold",
        d.kind === "resume" && d.positionTicks === seconds(300)
    );
}

check(
    "discards a position that barely started",
    decideProgress(seconds(MIN_RESUME_SECONDS - 1), seconds(3600)).kind === "discard"
);

{
    const d = decideProgress(seconds(3300), seconds(3600));
    check("treats the last tenth as finished", d.kind === "finished" && d.played === true);
    check(
        "resets the position when finished, so a replay starts at the beginning",
        d.kind === "finished" && d.positionTicks === 0
    );
}

{
    // Clients omit RunTimeTicks on most progress reports, so "finished"
    // simply is not decidable then -- it must not be guessed.
    const d = decideProgress(seconds(3300), null);
    check(
        "cannot decide finished without a runtime, and resumes instead",
        d.kind === "resume" && d.positionTicks === seconds(3300)
    );
}

check("ignores a zero runtime rather than dividing by it", decideProgress(seconds(300), 0).kind === "resume");
check("ignores a negative runtime", decideProgress(seconds(300), -1).kind === "resume");
check("clamps a negative position", decideProgress(-500, seconds(3600)).kind === "discard");

console.log("\nresumeTarget");

check("returns a position safely inside the file", resumeTarget(300, 3600) === 300);
check(
    "refuses a position past the end of a file replaced by a shorter release",
    resumeTarget(3000, 100) === null
);
check("refuses to resume inside the end guard", resumeTarget(3598, 3600) === null);
check("allows resuming before the duration is known", resumeTarget(300, undefined) === 300);
check("treats a zero position as nothing to resume", resumeTarget(0, 3600) === null);
check("rejects a non-finite position", resumeTarget(NaN, 3600) === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
