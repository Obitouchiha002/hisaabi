/**
 * PNG padhna — bina kisi package ke.
 *
 * Sirf itna chahiye jitna icon jaanchne ke liye zaroori hai: pixel nikalo aur
 * nishaan ka daayra naapo. Iske liye poori image library kheenchna bekaar hai.
 */

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };   // grey, rgb, grey+alpha, rgba

export function decode(path) {
  const data = readFileSync(path);
  const idat = [];
  let pos = 8, w, h, bitDepth, colourType;

  while (pos < data.length) {
    const len = data.readUInt32BE(pos);
    const type = data.toString('ascii', pos + 4, pos + 8);

    if (type === 'IHDR') {
      w = data.readUInt32BE(pos + 8);
      h = data.readUInt32BE(pos + 12);
      bitDepth = data[pos + 16];
      colourType = data[pos + 17];
    } else if (type === 'IDAT') {
      idat.push(data.subarray(pos + 8, pos + 8 + len));
    }
    pos += 12 + len;
  }

  const ch = CHANNELS[colourType];
  if (!ch || bitDepth !== 8) {
    throw new Error(`${path}: ye PNG nahi padh sakte (colourType ${colourType}, bitDepth ${bitDepth})`);
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const px = Buffer.alloc(stride * h);

  // Har line apne se pehli line ke fark me likhi hoti hai — wapas jodo
  let prev = Buffer.alloc(stride), i = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[i++];
    const line = Buffer.from(raw.subarray(i, i + stride));
    i += stride;

    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? line[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;

      if (filter === 1) line[x] = (line[x] + a) & 255;
      else if (filter === 2) line[x] = (line[x] + b) & 255;
      else if (filter === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }

    line.copy(px, y * stride);
    prev = line;
  }

  return { w, h, ch, px };
}

/**
 * Nishaan ki asli ink kahan tak failii hai.
 *
 * `dark: true` = gehra ₹ hare chaukor pe. `false` = hara ₹ paardarshi parde pe.
 * Font ka layout box yahan kaam nahi aata — usme aage-peeche ki khaali jagah
 * bhi gini jaati hai, aur usi ke chakkar me icon tedhe ban gaye the.
 */
export function inkBox(path, dark) {
  const { w, h, ch, px } = decode(path);
  let minX = w, maxX = -1, minY = h, maxY = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * ch;
      const r = px[p];
      const g = ch >= 3 ? px[p + 1] : px[p];
      const b = ch >= 3 ? px[p + 2] : px[p];
      const alpha = ch === 2 || ch === 4 ? px[p + ch - 1] : 255;
      if (alpha < 128) continue;

      const isInk = dark ? r + g + b < 260 : g > 150 && b < 160;
      if (!isInk) continue;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return null;

  return {
    w, h, minX, maxX, minY, maxY,
    dx: (minX + maxX) / 2 - w / 2,
    dy: (minY + maxY) / 2 - h / 2,
  };
}
