/**
 * Icon sach me center me hain? — `node scripts/check-icons.mjs`
 *
 * Ye test aankh pe bharosa nahi karta: PNG khud padh kar ₹ ki ink ka daayra
 * nikalta hai aur dekhta hai ki uska beech canvas ke beech se kitna hata hai.
 * Pehle wale icon me ye 1% se zyada tha aur saaf dikhta tha.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { inkBox } from './lib/png.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RES = join(root, 'app/android/app/src/main/res');

/**
 * Kitna khisakna manzoor hai — canvas ka 0.5%. Isse zyada aankh pakad leti hai.
 *
 * Kam se kam aadha pixel hamesha chhod dete hain: ink ka beech aadhe pixel pe
 * bhi aa sakta hai, aur 48px wale icon me usse kam khisakna mumkin hi nahi.
 */
const TOLERANCE = 0.005;
const limitFor = (w) => Math.max(0.5, w * TOLERANCE);

const TARGETS = [
  ...['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'].flatMap((d) => [
    [`mipmap-${d}/ic_launcher.png`, true],
    [`mipmap-${d}/ic_launcher_round.png`, true],
    [`mipmap-${d}/ic_launcher_foreground.png`, true],
    [`mipmap-${d}/splash_icon.png`, false],
  ]),
];

let fail = 0;
for (const [rel, dark] of TARGETS) {
  const path = join(RES, rel);
  if (!existsSync(path)) { console.log(`✗ ${rel} — file hi nahi hai`); fail++; continue; }

  const box = inkBox(path, dark);
  if (!box) { console.log(`✗ ${rel} — nishaan hi nahi mila`); fail++; continue; }

  const limit = limitFor(box.w);
  const ok = Math.abs(box.dx) <= limit && Math.abs(box.dy) <= limit;
  if (!ok) fail++;
  console.log(`${ok ? '✓' : '✗'} ${rel.padEnd(42)} ${box.w}px  khisak (${box.dx.toFixed(1)}, ${box.dy.toFixed(1)})`);
}

const icon = join(root, 'public/icon-1024.png');
if (existsSync(icon)) {
  const box = inkBox(icon, true);
  const ok = box && Math.abs(box.dx) <= limitFor(1024) && Math.abs(box.dy) <= limitFor(1024);
  if (!ok) fail++;
  console.log(`${ok ? '✓' : '✗'} public/icon-1024.png${' '.repeat(23)} 1024px  khisak (${box?.dx.toFixed(1)}, ${box?.dy.toFixed(1)})`);
}

console.log(fail ? `\n${fail} icon tede hain` : '\nsab icon center me hain');
process.exit(fail ? 1 : 0);
