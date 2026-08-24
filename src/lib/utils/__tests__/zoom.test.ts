import {
    IDENTITY,
    MIN_SCALE,
    SCALE_CEILING,
    clamp,
    clampTransform,
    containedSize,
    coverScale,
    midpoint,
    panBounds,
    pinchDistance,
    project,
    zoomAt,
    type Transform,
    type Viewport
} from "../zoom";

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

// A 16:9 stage and a 16:9 video: aspect ratios agree.
const view: Viewport = { width: 800, height: 450, left: 0, top: 0 };
// A phone held in landscape, taller and wider than 16:9 respectively.
const wideView: Viewport = { width: 900, height: 400, left: 0, top: 0 };
const tallView: Viewport = { width: 400, height: 800, left: 0, top: 0 };

console.log("\ncontained size -- where the video actually is at scale 1");
{
    const same = containedSize(view, 1920, 1080);
    check(
        "matching aspect ratios fill the stage exactly",
        near(same.width, 800) && near(same.height, 450),
        `${same.width}x${same.height}`
    );

    const letterboxed = containedSize(wideView, 1920, 1080);
    check(
        "a 16:9 video on a wider stage is limited by height",
        near(letterboxed.height, 400) && near(letterboxed.width, 400 * (16 / 9)),
        `${letterboxed.width}x${letterboxed.height}`
    );
    check(
        "and leaves bars at the sides, not top and bottom",
        letterboxed.width < wideView.width && near(letterboxed.height, wideView.height)
    );

    const pillarboxed = containedSize(tallView, 1920, 1080);
    check(
        "a 16:9 video on a portrait stage is limited by width",
        near(pillarboxed.width, 400) && near(pillarboxed.height, 225),
        `${pillarboxed.width}x${pillarboxed.height}`
    );
}

console.log("\ncover scale -- the maximum the viewer asked for");
{
    check(
        "matching aspect ratios cannot zoom at all: there are no bars",
        near(coverScale(view, 1920, 1080), 1),
        String(coverScale(view, 1920, 1080))
    );
    check(
        "a 16:9 video on a 9:4 stage covers at 900/711",
        near(coverScale(wideView, 1920, 1080), 900 / (400 * (16 / 9))),
        String(coverScale(wideView, 1920, 1080))
    );
    check(
        "a 16:9 video on a 1:2 stage needs a large but finite zoom",
        near(coverScale(tallView, 1920, 1080), 800 / 225),
        String(coverScale(tallView, 1920, 1080))
    );
    check(
        "cover is never below 1",
        coverScale(view, 1920, 1080) >= MIN_SCALE &&
            coverScale(wideView, 1920, 1080) >= MIN_SCALE
    );
    check(
        "an absurd aspect ratio is capped rather than allowed to explode",
        coverScale(tallView, 10000, 1) <= SCALE_CEILING,
        String(coverScale(tallView, 10000, 1))
    );
    check("an unprobed video reports no zoom room", near(coverScale(view, 0, 0), 1));
}

console.log("\nzoom is bounded by cover, not by an arbitrary constant");
{
    const max = coverScale(wideView, 1920, 1080);
    const t = zoomAt(wideView, { ...IDENTITY }, 99, 450, 200, max, 1920, 1080);
    check(
        "asking for more than cover yields exactly cover",
        near(t.scale, max),
        `${t.scale} vs ${max}`
    );

    const flat = zoomAt(view, { ...IDENTITY }, 4, 400, 225, coverScale(view, 1920, 1080), 1920, 1080);
    check(
        "a video that already fills the screen refuses to zoom",
        near(flat.scale, 1),
        String(flat.scale),
        );
    check("and stays centred when it refuses", near(flat.offsetX, 0) && near(flat.offsetY, 0));

    const down = zoomAt(wideView, { scale: max, offsetX: 0, offsetY: 0 }, 0.2, 450, 200, max, 1920, 1080);
    check("zooming below fit is not possible either", near(down.scale, MIN_SCALE));
}

console.log("\nanchoring");
{
    // The point under the fingers must not move as scale changes -- on the axis
    // that has somewhere to move. A 16:9 video on a portrait stage overflows
    // horizontally only, so vertical anchoring is correctly given up in favour
    // of staying centred; drifting up would just reveal a black bar.
    const max = coverScale(tallView, 1920, 1080);
    const anchor = { x: 150, y: 500 };
    let t: Transform = { ...IDENTITY };
    const cx = (anchor.x - 200 - t.offsetX) / t.scale;
    const cy = (anchor.y - 400 - t.offsetY) / t.scale;

    t = zoomAt(tallView, t, 2.5, anchor.x, anchor.y, max, 1920, 1080);
    const p = project(tallView, t, cx, cy);
    check(
        "anchor stays under the finger on the cropped axis",
        near(p.x, anchor.x, 0.01),
        `got x=${p.x.toFixed(2)}, wanted ${anchor.x}`
    );
    check(
        "and the uncropped axis stays centred rather than exposing a bar",
        near(t.offsetY, 0),
        String(t.offsetY)
    );
}

console.log("\npan bounds follow the video, not the stage");
{
    // At cover the video overflows on exactly one axis, and which one depends
    // on where the bars were. A 16:9 video on a 9:4 stage is pillarboxed, so
    // covering pushes it past the top and bottom and panning is vertical.
    const max = coverScale(wideView, 1920, 1080);
    const bounds = panBounds(wideView, { scale: max, offsetX: 0, offsetY: 0 }, 1920, 1080);
    check(
        "a pillarboxed video pans vertically once it covers",
        bounds.y > 0,
        String(bounds.y)
    );
    check(
        "and not horizontally, because that axis now fits exactly",
        near(bounds.x, 0),
        String(bounds.x)
    );

    // The letterboxed case is the mirror image.
    const tallMax = coverScale(tallView, 1920, 1080);
    const tallBounds = panBounds(tallView, { scale: tallMax, offsetX: 0, offsetY: 0 }, 1920, 1080);
    check("a letterboxed video pans horizontally once it covers", tallBounds.x > 0);
    check("and not vertically", near(tallBounds.y, 0));

    const atFit = panBounds(wideView, { scale: 1, offsetX: 0, offsetY: 0 }, 1920, 1080);
    check(
        "at fit the video is inside the stage, so panning is pointless",
        near(atFit.x, 0) && near(atFit.y, 0),
        `${atFit.x},${atFit.y}`,
    );
    check(
        "this is the bug the old stage-based bounds had: they allowed panning into the bars",
        atFit.x === 0
    );
}

console.log("\nclamping");
{
    const max = coverScale(tallView, 1920, 1080);
    const bounds = panBounds(tallView, { scale: max, offsetX: 0, offsetY: 0 }, 1920, 1080);
    const t = clampTransform(
        tallView,
        { scale: max, offsetX: 99999, offsetY: -99999 },
        max,
        1920,
        1080
    );
    check("offsets are held at the edge", near(t.offsetX, bounds.x) && near(t.offsetY, -bounds.y));

    const reset = clampTransform(tallView, { scale: 0.5, offsetX: 40, offsetY: 40 }, max, 1920, 1080);
    check(
        "dropping to fit recentres",
        reset.scale === MIN_SCALE && reset.offsetX === 0 && reset.offsetY === 0
    );
}

console.log("\nnon-finite input");
{
    check("NaN scale falls back to the minimum", clamp(NaN, 1, 4) === 1);
    check(
        "Infinity falls back to the minimum, not the maximum",
        clamp(Infinity, 1, 4) === 1,
        "snapping an unusable value to full zoom would be a nasty surprise mid-pinch"
    );
    const t = zoomAt(view, { ...IDENTITY }, NaN, 400, 225, 3, 1920, 1080);
    check(
        "a zero-distance pinch cannot produce scale(NaN)",
        Number.isFinite(t.scale) && Number.isFinite(t.offsetX) && Number.isFinite(t.offsetY)
    );
    const recovered = zoomAt(
        view,
        { scale: NaN, offsetX: NaN, offsetY: NaN },
        2,
        400,
        225,
        3,
        1920,
        1080
    );
    check(
        "a transform that already went bad does not poison the next gesture",
        Number.isFinite(recovered.scale) && Number.isFinite(recovered.offsetX)
    );
}

console.log("\ngeometry helpers");
{
    check("distance", near(pinchDistance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5));
    check("midpoint", (() => {
        const m = midpoint({ x: 0, y: 0 }, { x: 10, y: 20 });
        return near(m.x, 5) && near(m.y, 10);
    })());
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
