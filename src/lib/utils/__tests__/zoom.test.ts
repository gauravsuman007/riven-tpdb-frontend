import {
    IDENTITY,
    MAX_SCALE,
    MIN_SCALE,
    clampTransform,
    fillScale,
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

const view: Viewport = { width: 800, height: 450, left: 0, top: 0 };

console.log("anchoring");
{
    // The point under the fingers must not move as scale changes.
    const anchor = { x: 200, y: 120 };
    let t: Transform = { ...IDENTITY };
    // Content coords of the anchor before zooming.
    const cx = (anchor.x - 400 - t.offsetX) / t.scale;
    const cy = (anchor.y - 225 - t.offsetY) / t.scale;

    t = zoomAt(view, t, 2.5, anchor.x, anchor.y);
    const p = project(view, t, cx, cy);
    check(
        "anchor stays under the finger",
        near(p.x, anchor.x, 0.01) && near(p.y, anchor.y, 0.01),
        `got ${p.x.toFixed(2)},${p.y.toFixed(2)}`
    );

    // Repeated incremental zooms must not drift.
    let t2: Transform = { ...IDENTITY };
    for (let i = 0; i < 12; i++) t2 = zoomAt(view, t2, t2.scale * 1.1, anchor.x, anchor.y);
    const p2 = project(view, t2, cx, cy);
    check(
        "no drift over 12 pinch steps",
        near(p2.x, anchor.x, 0.5) && near(p2.y, anchor.y, 0.5),
        `got ${p2.x.toFixed(2)},${p2.y.toFixed(2)} scale=${t2.scale.toFixed(2)}`
    );
}

console.log("limits");
{
    check("min clamp", zoomAt(view, IDENTITY, 0.2, 400, 225).scale === MIN_SCALE);
    check("max clamp", zoomAt(view, IDENTITY, 99, 400, 225).scale === MAX_SCALE);
    const out = zoomAt(view, IDENTITY, 0.2, 100, 100);
    check("recentres at 1x", out.offsetX === 0 && out.offsetY === 0);
}

console.log("pan bounds");
{
    const t = { scale: 2, offsetX: 0, offsetY: 0 };
    const b = panBounds(view, 2);
    check("bounds are half the overflow", b.x === 400 && b.y === 225, `${b.x},${b.y}`);
    const dragged = clampTransform(view, { ...t, offsetX: 9999, offsetY: -9999 });
    check(
        "pan cannot expose an edge",
        dragged.offsetX === 400 && dragged.offsetY === -225,
        `${dragged.offsetX},${dragged.offsetY}`
    );
    check("no pan room at 1x", panBounds(view, 1).x === 0);
}

console.log("fill screen");
{
    // 16:9 video in a 16:9 stage already fills -> clamped to the 1.2 floor.
    check(
        "matched aspect needs no crop",
        fillScale(view, 1920, 1080) === 1.2,
        String(fillScale(view, 1920, 1080))
    );
    // 4:3 video in a 16:9 stage is pillarboxed; filling needs width/height ratio.
    const f = fillScale(view, 1440, 1080);
    check("4:3 in 16:9 fills at ~1.33", near(f, 800 / 450 / (1440 / 1080), 0.01), String(f));
    // 21:9 video in 16:9 stage is letterboxed.
    const w = fillScale(view, 2560, 1080);
    check("ultrawide fills", w > 1.3, String(w));
    check("degenerate video size is safe", fillScale(view, 0, 0) === 2);
    check("fill never exceeds max", fillScale(view, 100000, 1) === MAX_SCALE);
}

console.log("pinch helpers");
{
    check("distance", pinchDistance({ x: 0, y: 0 }, { x: 3, y: 4 }) === 5);
    const m = midpoint({ x: 0, y: 0 }, { x: 10, y: 20 });
    check("midpoint", m.x === 5 && m.y === 10);
    // A pinch that doubles finger separation should roughly double scale.
    const start = pinchDistance({ x: 300, y: 200 }, { x: 500, y: 200 });
    const now = pinchDistance({ x: 200, y: 200 }, { x: 600, y: 200 });
    const t = zoomAt(view, IDENTITY, 1 * (now / start), 400, 200);
    check("2x spread -> 2x scale", near(t.scale, 2), String(t.scale));
}

console.log("offset stability");
{
    // Zooming out to exactly 1 from a panned state must recentre, not leave
    // the image stuck off to one side.
    let t: Transform = { scale: 3, offsetX: 300, offsetY: 100 };
    t = zoomAt(view, t, 1, 400, 225);
    check(
        "zoom-out to 1x recentres",
        t.offsetX === 0 && t.offsetY === 0,
        `${t.offsetX},${t.offsetY}`
    );
    // Negative/NaN-ish inputs must not produce NaN.
    const bad = zoomAt(view, IDENTITY, NaN, 100, 100);
    check(
        "NaN scale does not propagate",
        Number.isFinite(bad.offsetX) && Number.isFinite(bad.offsetY),
        JSON.stringify(bad)
    );
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
