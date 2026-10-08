import { inflateSync } from "node:zlib";

/**
 * Whether a logo is mostly black: the mean brightness of its visible pixels
 * is under 70 of 255. Measured HERE, on the server, because the television
 * that draws these runs no script at all and cannot look at an image -- it
 * needs the answer in the markup. The web page measures in the browser and
 * agrees with this, which was checked against 120 real logos.
 *
 * PNG only, 8-bit, not interlaced -- which is what TPDB serves, nearly
 * without exception. Anything else is "not dark": the logo is drawn as it
 * always was, which is a missed plate and never a broken image.
 */
export function isDark(body: Buffer, type: string): boolean {
    if (type !== "image/png") return false;

    try {
        if (body.length < 33 || body.readUInt32BE(0) !== 0x89504e47) return false;

        let width = 0;
        let height = 0;
        let depth = 0;
        let color = 0;
        let interlace = 0;
        let palette: Buffer | null = null;
        let transparency: Buffer | null = null;
        const data: Buffer[] = [];

        for (let at = 8; at + 8 <= body.length; ) {
            const size = body.readUInt32BE(at);
            const kind = body.toString("latin1", at + 4, at + 8);
            const chunk = body.subarray(at + 8, at + 8 + size);

            if (kind === "IHDR") {
                width = chunk.readUInt32BE(0);
                height = chunk.readUInt32BE(4);
                depth = chunk[8];
                color = chunk[9];
                interlace = chunk[12];
            } else if (kind === "PLTE") palette = chunk;
            else if (kind === "tRNS") transparency = chunk;
            else if (kind === "IDAT") data.push(chunk);
            else if (kind === "IEND") break;

            at += 12 + size;
        }

        const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[color];

        if (!channels || depth !== 8 || interlace !== 0 || !width || !height) return false;
        if (width * height > 12_000_000 || (color === 3 && !palette)) return false;

        const stride = width * channels;
        const raw = inflateSync(Buffer.concat(data));

        if (raw.length < height * (stride + 1)) return false;

        // Undo the per-row filters in place.
        const pixels = Buffer.alloc(height * stride);

        for (let y = 0; y < height; y++) {
            const filter = raw[y * (stride + 1)];
            const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
            const out = pixels.subarray(y * stride, (y + 1) * stride);
            const above = y ? pixels.subarray((y - 1) * stride, y * stride) : null;

            for (let x = 0; x < stride; x++) {
                const a = x >= channels ? out[x - channels] : 0;
                const b = above ? above[x] : 0;
                const c = above && x >= channels ? above[x - channels] : 0;
                let predictor = 0;

                if (filter === 1) predictor = a;
                else if (filter === 2) predictor = b;
                else if (filter === 3) predictor = (a + b) >> 1;
                else if (filter === 4) {
                    const p = a + b - c;
                    const pa = Math.abs(p - a);
                    const pb = Math.abs(p - b);
                    const pc = Math.abs(p - c);

                    predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
                } else if (filter !== 0) return false;

                out[x] = (line[x] + predictor) & 255;
            }
        }

        let seen = 0;
        let light = 0;

        for (let i = 0; i < pixels.length; i += channels) {
            let r: number;
            let g: number;
            let b: number;
            let alpha = 255;

            if (color === 6)
                [r, g, b, alpha] = [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
            else if (color === 2) [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
            else if (color === 4)
                [r, g, b, alpha] = [pixels[i], pixels[i], pixels[i], pixels[i + 1]];
            else if (color === 0) [r, g, b] = [pixels[i], pixels[i], pixels[i]];
            else {
                const index = pixels[i];

                [r, g, b] = [palette![index * 3], palette![index * 3 + 1], palette![index * 3 + 2]];
                alpha = transparency && index < transparency.length ? transparency[index] : 255;
            }

            if (alpha < 128) continue;

            seen++;
            light += (r * 299 + g * 587 + b * 114) / 1000;
        }

        return seen > 20 && light / seen < 70;
    } catch {
        return false;
    }
}
