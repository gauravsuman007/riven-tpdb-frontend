/**
 * Every theme's UI boundaries must be visible against its own background.
 *
 * This exists because 13 of 15 themes shipped with `--input` and `--border`
 * below 1.7:1 -- checkboxes and text fields were invisible until focused, since
 * `--ring` (which passed in every theme) is what draws the focus outline. It
 * read as a Dark Reader problem and was not; it was the theme tokens.
 *
 * Thresholds are WCAG 2.2: 3:1 for the boundary of a UI component (1.4.11),
 * 4.5:1 for body text (1.4.3). Backgrounds checked are `--background`,
 * `--card` and `--popover`, because a field can sit on any of them.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const THEME_DIR = "src/themes";

let pass = 0;
let fail = 0;

function check(name: string, condition: boolean, extra = "") {
    if (condition) {
        pass++;
    } else {
        fail++;
        console.log(`  FAIL ${name} ${extra}`);
    }
}

type Oklch = { l: number; c: number; h: number };

function parseOklch(value: string): Oklch | null {
    const m = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.-]+)\s*\)$/.exec(value.trim());
    if (!m) return null;
    let l = Number(m[1]);
    // Both `oklch(18% ...)` and `oklch(0.18 ...)` appear across these files.
    if (m[2] === "%" || l > 1.5) l /= 100;
    return { l, c: Number(m[3]), h: Number(m[4]) };
}

/** Oklch -> linear-light sRGB -> relative luminance (WCAG 2.x). */
function luminance({ l, c, h }: Oklch): number {
    const hr = (h * Math.PI) / 180;
    const a = c * Math.cos(hr);
    const b = c * Math.sin(hr);

    const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

    const rgb = [
        4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
        -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
        -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S
    ].map((x) => Math.min(1, Math.max(0, x)));

    // Clamping above already put us in gamut, so these are linear-light values
    // and need no sRGB decode round-trip.
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function contrast(a: Oklch, b: Oklch): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

function tokensOf(css: string): Record<string, string> | null {
    const block = /html\[data-theme="[\w-]+"\]\s*\{([\s\S]*?)\n\}/.exec(css);
    if (!block) return null;
    const out: Record<string, string> = {};
    for (const m of block[1].matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
    return out;
}

const files = readdirSync(THEME_DIR).filter((f) => f.endsWith(".css") && f !== "all.css");

check("theme files were found at all", files.length > 0, `looked in ${THEME_DIR}`);

// Guard the guard: if the parser silently stopped matching, every theme would
// be skipped and this suite would pass while testing nothing.
let themesChecked = 0;

const REQUIREMENTS: Array<{ token: string; min: number; why: string }> = [
    { token: "input", min: 3, why: "field and checkbox borders (WCAG 1.4.11)" },
    { token: "border", min: 3, why: "card and divider borders (WCAG 1.4.11)" },
    { token: "ring", min: 3, why: "focus outline (WCAG 1.4.11)" },
    { token: "muted-foreground", min: 4.5, why: "placeholder and secondary text (WCAG 1.4.3)" },
    { token: "foreground", min: 4.5, why: "body text (WCAG 1.4.3)" }
];

for (const file of files) {
    const tokens = tokensOf(readFileSync(join(THEME_DIR, file), "utf8"));
    if (!tokens) continue;

    const backdrops = ["background", "card", "popover"]
        .map((k) => (tokens[k] ? parseOklch(tokens[k]) : null))
        .filter((v): v is Oklch => v !== null);

    if (!backdrops.length) continue;
    themesChecked++;

    const theme = file.replace(/\.css$/, "");

    for (const { token, min, why } of REQUIREMENTS) {
        const colour = tokens[token] ? parseOklch(tokens[token]) : null;
        if (!colour) continue;

        const worst = Math.min(...backdrops.map((bd) => contrast(colour, bd)));

        check(
            `${theme}: --${token} >= ${min}:1`,
            worst >= min,
            `got ${worst.toFixed(2)}:1 against its own background -- ${why}`
        );
    }
}

check(
    "every theme file parsed",
    themesChecked === files.length,
    `${themesChecked}/${files.length}`
);

console.log(`\n${pass} passed, ${fail} failed  (${themesChecked} themes)`);
process.exit(fail ? 1 : 0);
