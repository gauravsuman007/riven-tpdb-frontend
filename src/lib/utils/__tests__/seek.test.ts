import {
    BASE_SECONDS_PER_PX,
    FLING_MIN_VELOCITY,
    MAX_GAIN,
    clampTime,
    flingBonus,
    formatOffset,
    formatTime,
    recentSamples,
    releaseVelocity,
    seekDelta,
    velocityBetween,
    velocityGain
} from "../seek";

let pass = 0,
    fail = 0;
function check(name: string, cond: boolean, extra = "") {
    if (cond) {
        pass++;
        console.log(`  ok   ${name}`);
    } else {
        fail++;
        console.log(`  FAIL ${name} ${extra}`);
    }
}
const near = (a: number, b: number, eps = 0.001) => Math.abs(a - b) < eps;

console.log("\nvelocity gain -- the point of the whole exercise");
{
    check("at rest the gain is 1, so a slow drag is frame-accurate", near(velocityGain(0), 1));
    check("gain rises with speed", velocityGain(2) > velocityGain(0.5));
    check("direction does not change the gain", near(velocityGain(-3), velocityGain(3)));
    check(
        "a violent flick is capped rather than throwing the position away",
        near(velocityGain(1000), MAX_GAIN),
        String(velocityGain(1000))
    );
    check("a non-finite velocity degrades to no gain", near(velocityGain(NaN), 1));

    // The behaviour the user actually asked for: same distance, different speed,
    // meaningfully different seek.
    const slow = seekDelta(100, 0.2);
    const fast = seekDelta(100, 3);
    check(
        "the same 100px seeks much further when flicked than when dragged",
        fast > slow * 2,
        `slow ${slow.toFixed(1)}s vs fast ${fast.toFixed(1)}s`
    );
}

console.log("\nseek delta");
{
    check(
        "at rest the ratio is the documented base",
        near(seekDelta(100, 0), 100 * BASE_SECONDS_PER_PX)
    );
    check("dragging left seeks backwards", seekDelta(-50, 0.5) < 0);
    check("dragging right seeks forwards", seekDelta(50, 0.5) > 0);
    check("no movement is no seek", near(seekDelta(0, 5), 0));
    check("a non-finite movement is ignored", near(seekDelta(NaN, 1), 0));
}

console.log("\nvelocity measurement");
{
    check("simple case", near(velocityBetween({ x: 0, t: 0 }, { x: 100, t: 50 }), 2));
    check("backwards is negative", velocityBetween({ x: 100, t: 0 }, { x: 0, t: 50 }) < 0);
    check(
        "coalesced events sharing a timestamp do not divide by zero",
        velocityBetween({ x: 0, t: 10 }, { x: 100, t: 10 }) === 0,
        "this yields Infinity if unguarded, and Infinity seconds of seek"
    );
    check(
        "time going backwards is rejected too",
        velocityBetween({ x: 0, t: 50 }, { x: 100, t: 10 }) === 0
    );
}

console.log("\nrelease velocity is averaged, not taken from the last pair");
{
    const samples = [
        { x: 0, t: 0 },
        { x: 60, t: 30 },
        { x: 120, t: 60 },
        { x: 180, t: 90 },
        // Fingers stutter as they lift: one bad pair reports a stop.
        { x: 180, t: 95 }
    ];
    check(
        "a stuttering lift does not report a dead stop",
        releaseVelocity(samples) > 1,
        String(releaseVelocity(samples))
    );
    check("a single sample has no velocity", releaseVelocity([{ x: 0, t: 0 }]) === 0);
    check("no samples has no velocity", releaseVelocity([]) === 0);

    const old = [
        { x: 0, t: 0 },
        { x: 500, t: 20 },
        { x: 505, t: 400 },
        { x: 506, t: 450 }
    ];
    check(
        "stale samples outside the window are dropped",
        recentSamples(old, 100).length === 2,
        String(recentSamples(old, 100).length)
    );
    check(
        "so a fast start followed by a slow finish releases slowly",
        Math.abs(releaseVelocity(old)) < 1,
        String(releaseVelocity(old))
    );
}

console.log("\nfling");
{
    check("a slow release adds nothing", near(flingBonus(0.1), 0));
    check(
        "exactly at the threshold nothing is added",
        near(flingBonus(FLING_MIN_VELOCITY - 0.0001), 0)
    );
    check("a flick adds forward travel", flingBonus(3) > 0);
    check("a backwards flick adds backwards travel", flingBonus(-3) < 0);
    check("a faster flick adds more", flingBonus(4) > flingBonus(1));
    check("a non-finite release is ignored", near(flingBonus(Infinity), 0));
}

console.log("\nclamping to the media");
{
    check("seeking past the end lands on the end", near(clampTime(9999, 600), 600));
    check("seeking before the start lands on zero", near(clampTime(-50, 600), 0));
    check("inside the range is untouched", near(clampTime(123, 600), 123));
    check(
        "an unknown duration still refuses negative time",
        near(clampTime(-5, NaN), 0),
        "duration is NaN until metadata loads, which is exactly when a swipe can arrive"
    );
    check("an unknown duration does not cap forwards", near(clampTime(500, 0), 500));
}

console.log("\nformatting");
{
    check("forward offset", formatOffset(83) === "+1:23");
    check("backward offset", formatOffset(-45) === "-0:45");
    check("zero reads as forward, not as a stray minus", formatOffset(0) === "+0:00");
    check("hours appear when needed", formatOffset(3725) === "+1:02:05");
    check("offsets round rather than truncate", formatOffset(59.6) === "+1:00");

    check("absolute time", formatTime(245) === "4:05");
    check("absolute time with hours", formatTime(3725) === "1:02:05");
    check("NaN duration reads as zero, not NaN:NaN", formatTime(NaN) === "0:00");
    check("negative time reads as zero", formatTime(-5) === "0:00");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
