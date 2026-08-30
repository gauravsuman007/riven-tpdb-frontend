/*
    Downlevel the stylesheet for LG webOS.

    riven-tpdb's CSS is Tailwind v4 output, and Tailwind v4 wraps EVERYTHING
    in cascade layers -- `@layer theme{...}`, `@layer base{...}`,
    `@layer utilities{...}`. A browser that does not understand `@layer`
    discards those blocks whole, which is not "some styles missing" but no
    styles at all. That is the unstyled page reported on webOS, and it was
    misread as the old double-gzip proxy bug: the bytes arrive intact
    (verified: 227,768 bytes of plaintext CSS through the multiplexer), the
    TV simply cannot parse them.

    `@layer` needs Chromium 99, `@container` 105, `oklch()` and `color-mix()`
    111. LG ships: webOS 5 -> Chromium 68, 6 -> 79, 22 -> 87, 23 -> 94,
    24 -> 108, 25 -> ~120. So no shipping webOS before 25 renders this
    stylesheet correctly, and nothing before 24 renders it at all.

    Target Chromium 94 (webOS 23+) rather than lower. It is where `:is()`
    lands, and Tailwind v4 writes every dark-mode rule as `:is(.dark *)` --
    below that target those selectors are dropped instead of downleveled,
    which trades an unstyled page for a light-themed one on a dark-themed
    app. Going lower is a one-line change here if an older TV turns up.

    Known and accepted: `color-mix()` survives. It is Tailwind's opacity
    modifier (`bg-background/10`) and resolves to
    `color-mix(in oklab, var(--x) 50%, transparent)` -- a mix of a variable,
    which cannot be computed at build time by anyone. Those declarations are
    dropped by old engines, so translucent fills lose their transparency.
    Base colours still apply.
*/
import postcssPresetEnv from "postcss-preset-env";

export default {
    plugins: [postcssPresetEnv({ browsers: "chrome >= 94", stage: 0 })]
};
