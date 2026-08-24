/**
 * Zoom/pan maths for the overlay player.
 *
 * Extracted from the component so it can be tested directly: pinch behaviour
 * is easy to get subtly wrong (content drifting out from under the fingers,
 * edges pulling into view) and those bugs are miserable to chase in a browser.
 *
 * The model, which changed after the first version got it backwards:
 *
 *   scale 1        the whole frame is visible, letterboxed if the video and
 *                  the screen disagree about aspect ratio. This is where
 *                  playback starts, including in fullscreen.
 *   scale = cover  the letterboxing is exactly gone and the video fills the
 *                  screen, cropped on the long axis. This is the *maximum*.
 *
 * There is deliberately no zoom past cover. Beyond that point every extra
 * pixel of scale only throws away picture, which is not something a viewer
 * asked for by pinching to "fill the screen".
 */

export const MIN_SCALE = 1;

/**
 * Absolute ceiling, independent of aspect ratio.
 *
 * Real content stops at `coverScale`, which is well under this for any sane
 * pairing. It exists only so a garbage probe (a 1x10000 "video") cannot ask
 * for a transform that hangs the compositor.
 */
export const SCALE_CEILING = 8;

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
 * Size the video actually occupies at scale 1.
 *
 * The element is `object-fit: contain`, so it is letterboxed inside the stage
 * rather than filling it. Everything below has to reason about *this* rect,
 * not the stage, or panning wanders off into the black bars.
 */
export function containedSize(
    view: Viewport,
    videoWidth: number,
    videoHeight: number
): { width: number; height: number } {
    if (!videoWidth || !videoHeight || !view.width || !view.height) {
        return { width: view.width, height: view.height };
    }

    const boxRatio = view.width / view.height;
    const videoRatio = videoWidth / videoHeight;

    return videoRatio > boxRatio
        ? { width: view.width, height: view.width / videoRatio }
        : { width: view.height * videoRatio, height: view.height };
}

/**
 * Scale at which the letterboxing disappears and the video covers the stage.
 *
 * Returns 1 when the aspect ratios already match: there are no bars to remove,
 * so there is nothing to zoom into.
 */
export function coverScale(view: Viewport, videoWidth: number, videoHeight: number): number {
    if (!videoWidth || !videoHeight || !view.width || !view.height) return MIN_SCALE;

    const contained = containedSize(view, videoWidth, videoHeight);

    if (!contained.width || !contained.height) return MIN_SCALE;

    const factor = Math.max(view.width / contained.width, view.height / contained.height);

    return clamp(factor, MIN_SCALE, SCALE_CEILING);
}

/**
 * Largest pan offsets that keep the video covering the stage.
 *
 * Measured against the *rendered* video rect. Below cover the video is smaller
 * than the stage on at least one axis, and on that axis there is nothing to
 * pan -- moving would only slide the picture around inside its own bars.
 */
export function panBounds(
    view: Viewport,
    transform: Transform,
    videoWidth = 0,
    videoHeight = 0
): { x: number; y: number } {
    const contained = containedSize(view, videoWidth, videoHeight);
    const scale = Math.max(transform.scale, MIN_SCALE);

    return {
        x: Math.max(0, (contained.width * scale - view.width) / 2),
        y: Math.max(0, (contained.height * scale - view.height) / 2)
    };
}

export function clampTransform(
    view: Viewport,
    transform: Transform,
    maxScale = SCALE_CEILING,
    videoWidth = 0,
    videoHeight = 0
): Transform {
    const ceiling = clamp(maxScale, MIN_SCALE, SCALE_CEILING);
    const scale = clamp(transform.scale, MIN_SCALE, ceiling);

    // Fully zoomed out there is nothing to pan; snapping to centre avoids a
    // drifted image that looks broken at 1x.
    if (scale <= MIN_SCALE) return { scale: MIN_SCALE, offsetX: 0, offsetY: 0 };

    const bounds = panBounds(view, { ...transform, scale }, videoWidth, videoHeight);

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
    clientY: number,
    maxScale = SCALE_CEILING,
    videoWidth = 0,
    videoHeight = 0
): Transform {
    const centreX = view.left + view.width / 2;
    const centreY = view.top + view.height / 2;
    const scale = clamp(nextScale, MIN_SCALE, clamp(maxScale, MIN_SCALE, SCALE_CEILING));

    // Guard the divisor too: a transform that has already gone bad must not
    // poison the next gesture.
    const current =
        Number.isFinite(transform.scale) && transform.scale > 0 ? transform.scale : MIN_SCALE;

    // Anchor expressed in content units at the current scale.
    const contentX = (clientX - centreX - (transform.offsetX || 0)) / current;
    const contentY = (clientY - centreY - (transform.offsetY || 0)) / current;

    return clampTransform(
        view,
        {
            scale,
            offsetX: clientX - centreX - contentX * scale,
            offsetY: clientY - centreY - contentY * scale
        },
        maxScale,
        videoWidth,
        videoHeight
    );
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

export function pinchDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(
    a: { x: number; y: number },
    b: { x: number; y: number }
): { x: number; y: number } {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
