/**
 * App icon aur splash — `node scripts/icons.mjs`.
 *
 * Pehle ye icon haath se banaye gaye the aur ₹ neeche-daayen khisak gaya tha.
 * Wajah: font har akshar ke aage-peeche apni marzi ki khaali jagah (side
 * bearing) rakhta hai. "Beech me rakho" bolne pe wo khaali jagah bhi gin li
 * jaati hai, aur nishaan tirchha baith jata hai.
 *
 * Browser ka `getBBox()` bhi kaam nahi aaya — wo text ka *layout* box deta hai,
 * ink ka nahi. Isliye yahan do baar render hota hai:
 *
 *   1. glyph waise hi banao
 *   2. bane hue PNG ke pixel padh kar ink ka asli daayra naapo
 *   3. utna hi ulta khiska kar dobara banao
 *
 * Font badlo, size badlo — nishaan hamesha theek beech me baithega. Naap ke
 * liye `scripts/check-icons.mjs` chalao.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { inkBox } from './lib/png.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RES = join(root, 'app/android/app/src/main/res');
const FONT = join(root, 'app/public/fonts/BricolageGrotesque-800-3y9K6a.woff2');

const ACCENT = '#D6FF3D';
const INK = '#12140A';

const DENSITIES = [
  ['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4],
];

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const fontData = readFileSync(FONT).toString('base64');

const tmp = join(root, '.icon-tmp');

function page(size, glyphEm, bg, fg, shift) {
  return `<!doctype html><meta charset="utf-8">
<style>
  @font-face { font-family: M; src: url(data:font/woff2;base64,${fontData}) format('woff2'); }
  html, body { margin: 0; background: transparent; }
  svg { display: block; }
</style>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  ${bg ? `<rect width="${size}" height="${size}" rx="${(size * 0.22).toFixed(1)}" fill="${bg}"/>` : ''}
  <text x="${(size / 2 - shift.x).toFixed(2)}" y="${(size / 2 - shift.y).toFixed(2)}"
        text-anchor="middle" dominant-baseline="central"
        font-family="M" font-size="${(size * glyphEm).toFixed(2)}" fill="${fg}">&#8377;</text>
</svg>`;
}

function shoot(out, size, glyphEm, bg, fg, shift) {
  const html = join(tmp, 'page.html');
  writeFileSync(html, page(size, glyphEm, bg, fg, shift));

  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    // paardarshi — warna har icon ke peeche safed chaukor aa jata hai
    '--default-background-color=00000000',
    `--screenshot=${out}`,
    `--window-size=${size},${size}`,
    '--virtual-time-budget=2500',
    `file://${html}`,
  ], { stdio: 'ignore' });
}

/** Do baar: pehle naapo, phir sudhaar ke saath banao. */
function render(out, size, glyphEm, bg, fg) {
  const dark = fg === INK;

  shoot(out, size, glyphEm, bg, fg, { x: 0, y: 0 });
  const box = inkBox(out, dark);
  if (!box) throw new Error(`${out}: nishaan hi nahi bana`);

  shoot(out, size, glyphEm, bg, fg, { x: box.dx, y: box.dy });

  const after = inkBox(out, dark);
  console.log(`  ${out.replace(root + '/', '').padEnd(52)} ${size}px  ${fmt(box)} → ${fmt(after)}`);
}

const fmt = (b) => `(${b.dx.toFixed(1)}, ${b.dy.toFixed(1)})`;

rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

console.log('launcher — hara chaukor + gehra ₹');
for (const [d, k] of DENSITIES) {
  const size = Math.round(48 * k * 4 / 3);
  render(join(RES, `mipmap-${d}/ic_launcher.png`), size, 0.62, ACCENT, INK);
  render(join(RES, `mipmap-${d}/ic_launcher_round.png`), size, 0.62, ACCENT, INK);
}

/* Adaptive icon ka bahri 1/3 hissa system kaat deta hai, isliye foreground me
   nishaan chhota rakhna padta hai — warna ₹ ke kone kat jayenge. */
console.log('\nadaptive foreground — sirf ₹ (kinara system kaat deta hai)');
for (const [d, k] of DENSITIES) {
  render(join(RES, `mipmap-${d}/ic_launcher_foreground.png`), Math.round(108 * k * 2), 0.42, null, INK);
}

console.log('\nsplash — gehre parde pe hara ₹');
for (const [d, k] of DENSITIES) {
  render(join(RES, `mipmap-${d}/splash_icon.png`), Math.round(96 * k * 1.5), 0.6, null, ACCENT);
}

console.log('\nwebsite');
render(join(root, 'public/icon-1024.png'), 1024, 0.62, ACCENT, INK);

rmSync(tmp, { recursive: true, force: true });
console.log('\n✓ ho gaya — ab `node scripts/check-icons.mjs`');
