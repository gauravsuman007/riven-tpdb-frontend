/**
 * Zoom/pan maths for the overlay player.
 *
 * Extracted from the component so it can be tested directly: pinch behaviour
 * is easy to get subtly wrong (content drifting out from under the fingers,
 * edges pulling into view) and those bugs are miserable to chase in a browser.
 */

export const MIN_SCALE = 1;
export const MAX_SCALE = 5;

export interface Viewport {
    /** Stage size in CSS pixels. */
    width: number;
    height: number;
    /** Stage position, so client coordinates can be made relative. */
    left: number;
    top: number;
}

export interface Transform {
    scale: number;
    offsetX: number;
    offsetY: number;
}

export const IDENTITY: Transform = { scale: 1, offsetX: 0, offsetY: 0 };

export function clamp(value: number, min: number, max: number): number {
    // A pinch whose two touches land on the same point yields 0/0, and a
    // non-finite scale would render as scale(NaN) and blank the video. Treat
    // anything not a real number as "no change from the minimum".
    if (!Number.isFinite(value)) return min;

    return Math.min(Math.max(value, min), max);
}

/**
 * Largest pan offsets that keep the scaled content covering the stage.
 *
 * At scale s the content overflows its box by (s-1)/2 of the box size on each
 * side, which is exactly how far it may travel before an edge comes into view.
 */
export function panBounds(view: Viewport, scale: number): { x: number; y: number } {
    return {
        x: (view.width * Math.max(scale - 1, 0)) / 2,
        y: (view.height * Math.max(scale - 1, 0)) / 2
    };
}

export function clampTransform(view: Viewport, transform: Transform): Transform {
    const scale = clamp(transform.scale, MIN_SCALE, MAX_SCALE);

    // Fully zoomed out there is nothing to pan; snapping to centre avoids a
    // drifted image that looks broken at 1x.
    if (scale <= MIN_SCALE) return { scale: MIN_SCALE, offsetX: 0, offsetY: 0 };

    const bounds = panBounds(view, scale);

    return {
        scale,
        offsetX: clamp(transform.offsetX, -bounds.x, bounds.x),
        offsetY: clamp(transform.offsetY, -bounds.y, bounds.y)
    };
}

/**
 * Scale about a fixed point, so whatever sits under the fingers or cursor
 * stays there. Without an anchor the image slides away as it grows.
 */
export function zoomAt(
    view: Viewport,
    transform: Transform,
    nextScale: number,
    clientX: number,
    clientY: number
): Transform {
    const centreX = view.left + view.width / 2;
    const centreY = view.top + view.height / 2;
    const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);

    // Guard the divisor too: a transform that has already gone bad must not
    // poison the next gesture.
    const current =
        Number.isFinite(transform.scale) && transform.scale > 0 ? transform.scale : MIN_SCALE;

    // Anchor expressed in content units at the current scale.
    const contentX = (clientX - centreX - (transform.offsetX || 0)) / current;
    const contentY = (clientY - centreY - (transform.offsetY || 0)) / current;

    return clampTransform(view, {
        scale,
        offsetX: clientX - centreX - contentX * scale,
        offsetY: clientY - centreY - contentY * scale
    });
}

/** Where a content point currently lands on screen. Used to verify anchoring. */
export function project(
    view: Viewport,
    transform: Transform,
    contentX: number,
    contentY: number
): { x: number; y: number } {
    return {
        x: view.left + view.width / 2 + transform.offsetX + contentX * transform.scale,
        y: view.top + view.height / 2 + transform.offsetY + contentY * transform.scale
    };
}

/**
 * Scale at which video of the given aspect ratio stops being letterboxed and
 * covers the stage entirely -- the "fill screen" step MX Player offers.
 */
export function fillScale(view: Viewport, videoWidth: number, videoHeight: number): number {
    if (!videoWidth || !videoHeight || !view.width || !view.height) return 2;

    const boxRatio = view.width / view.height;
    const videoRatio = videoWidth / videoHeight;
    const fill = videoRatio > boxRatio ? videoRatio / boxRatio : boxRatio / videoRatio;

    return clamp(fill, 1.2, MAX_SCALE);
}

export function pinchDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(
    a: { x: number; y: number },
    b: { x: number; y: number }
): { x: number; y: number } {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
