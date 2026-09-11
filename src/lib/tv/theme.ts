/*
    The theme, in a form a 2016 television can read.

    `darkmatter.css` states every colour in `oklch()`, which is Chromium 111.
    The television is Chromium 53, where an `oklch()` declaration is not a
    wrong colour but no colour at all -- the whole declaration is dropped,
    silently, and the viewer gets whatever the previous rule said.

    So the values are converted to hex here and served to that surface,
    rather than being transcribed by hand into the other repo where they
    would drift the first time this theme is touched. The stylesheet is the
    single source; this file is a reader, not a second copy.

    `?raw` because the values are needed as text, not as a stylesheet: Vite
    hands over the file's contents and nothing is injected into the page.
*/

import darkmatter from "../../themes/darkmatter.css?raw";

/*
    oklch -> sRGB, the matrices from the Oklab paper. Exact, not an
    approximation: a colour that is nearly the accent is worse than one that
    is obviously wrong, because nobody reports it and it never gets fixed.
*/
const LMS = [
    [1, 0.3963377774, 0.2158037573],
    [1, -0.1055613458, -0.0638541728],
    [1, -0.0894841775, -1.291485548]
];

const RGB = [
    [4.0767416621, -3.3077115913, 0.2309699292],
    [-1.2684380046, 2.6097574011, -0.3413193965],
    [-0.0041960863, -0.7034186147, 1.707614701]
];

function channel(value: number): string {
    const gamma = value <= 0.0031308 ? 12.92 * value : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;

    return Math.round(Math.min(1, Math.max(0, gamma)) * 255)
        .toString(16)
        .padStart(2, "0");
}

export function oklchToHex(l: number, c: number, h: number): string {
    const a = c * Math.cos((h * Math.PI) / 180);
    const b = c * Math.sin((h * Math.PI) / 180);
    const cone = LMS.map((r) => (r[0] * l + r[1] * a + r[2] * b) ** 3);

    return `#${RGB.map((r) => channel(r[0] * cone[0] + r[1] * cone[1] + r[2] * cone[2]))
        .map((hex) => hex)
        .join("")}`;
}

/*
    Only the tokens the other surface actually paints with. Serving all
    forty would invite it to use one, and a token this app can restyle
    freely is not a promise worth making across a repository boundary.
*/
const WANTED = [
    "background",
    "foreground",
    "card",
    "primary",
    "primary-foreground",
    "muted",
    "muted-foreground",
    "accent",
    "border",
    "destructive",
    "sidebar",
    "sidebar-border"
] as const;

export type ThemeToken = (typeof WANTED)[number];

/** The darkmatter tokens, as hex. Parsed once; the file cannot change at runtime. */
export function themeTokens(): Record<string, string> {
    const out: Record<string, string> = {};

    for (const name of WANTED) {
        const found = new RegExp(
            `--${name}:\\s*oklch\\(\\s*([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\s*\\)`
        ).exec(darkmatter);

        if (found) {
            out[name] = oklchToHex(Number(found[1]), Number(found[2]), Number(found[3]));
        }
    }

    return out;
}
