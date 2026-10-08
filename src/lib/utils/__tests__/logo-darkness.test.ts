/**
 * What counts as a "dark" studio logo, and what never throws.
 *
 * Built from synthetic PNGs so the cases are exact: a logo that is mostly
 * black disappears on the dark card and needs a light plate; white, coloured
 * or mostly transparent ones do not. `isDark` is also what riven-tv relies
 * on, so a wrong "dark" is a white logo on a white plate -- invisible.
 *
 * Run with: npx tsx src/lib/utils/__tests__/logo-darkness.test.ts
 */

import { deflateSync } from "node:zlib";

import { isDark } from "../logo-darkness";

let pass = 0;
let fail = 0;

function check(condition: boolean, name: string) {
    if (condition) {
        pass++;
        console.log(`  ok   ${name}`);
    } else {
        fail++;
        console.log(`  FAIL ${name}`);
    }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

function crc(buffer: Buffer): number {
    let c = 0xffffffff;
    for (const byte of buffer) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(kind: string, data: Buffer): Buffer {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(kind, 4, "latin1");
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, tail]);
}

/** A 16x16 PNG; `pixel(x, y)` returns the raw bytes of one pixel. */
function png(
    color: number,
    channels: number,
    pixel: (x: number, y: number) => number[],
    palette?: number[][]
) {
    const size = 16;
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header[8] = 8;
    header[9] = color;
    const rows: number[] = [];
    for (let y = 0; y < size; y++) {
        rows.push(0); // filter: none
        for (let x = 0; x < size; x++) rows.push(...pixel(x, y));
    }
    return Buffer.concat([
        Buffer.from("89504e470d0a1a0a", "hex"),
        chunk("IHDR", header),
        ...(palette ? [chunk("PLTE", Buffer.from(palette.flat()))] : []),
        chunk("IDAT", deflateSync(Buffer.from(rows))),
        chunk("IEND", Buffer.alloc(0))
    ]);
}

const opaque = (r: number, g: number, b: number) => () => [r, g, b, 255];

check(isDark(png(6, 4, opaque(0, 0, 0)), "image/png"), "an all-black logo is dark");
check(!isDark(png(6, 4, opaque(255, 255, 255)), "image/png"), "an all-white logo is not");
check(!isDark(png(6, 4, opaque(231, 138, 83)), "image/png"), "a coloured logo is not");
check(
    isDark(png(6, 4, opaque(200, 20, 20)), "image/png") === false,
    "a bright red one is not (Devil's Film reads fine on dark)"
);
check(isDark(png(6, 4, opaque(40, 10, 10)), "image/png"), "a near-black one is");
check(
    !isDark(
        png(6, 4, (x) => (x < 2 ? [0, 0, 0, 255] : [255, 255, 255, 255])),
        "image/png"
    ),
    "mostly white with a little black is not"
);
check(
    !isDark(
        png(6, 4, (x) => (x < 14 ? [0, 0, 0, 0] : [255, 255, 255, 255])),
        "image/png"
    ),
    "transparent pixels do not count: only what is visible is measured"
);
check(
    isDark(
        png(2, 3, () => [0, 0, 0]),
        "image/png"
    ),
    "RGB without alpha"
);
check(
    isDark(
        png(0, 1, () => [10]),
        "image/png"
    ) &&
        !isDark(
            png(0, 1, () => [240]),
            "image/png"
        ),
    "greyscale"
);
check(
    isDark(
        png(4, 2, () => [0, 255]),
        "image/png"
    ),
    "greyscale with alpha"
);
check(
    isDark(
        png(3, 1, () => [0], [[0, 0, 0]]),
        "image/png"
    ) &&
        !isDark(
            png(3, 1, () => [0], [[255, 255, 255]]),
            "image/png"
        ),
    "palette images read their palette, not the index"
);
check(
    !isDark(png(6, 4, opaque(0, 0, 0)), "image/jpeg"),
    "only PNG is measured; anything else is not dark"
);
check(
    !isDark(Buffer.from("not a png at all, but long enough to try......"), "image/png"),
    "garbage is not dark and does not throw"
);
check(!isDark(Buffer.alloc(0), "image/png"), "an empty body is not dark");
check(
    !isDark(png(6, 4, opaque(0, 0, 0)).subarray(0, 60), "image/png"),
    "a truncated file is not dark and does not throw"
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
