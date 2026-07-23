/**
 * Website (static) + app (Vite) → ek `dist/` folder, jo Vercel serve karta hai.
 *
 *   dist/index.html      landing
 *   dist/assets/…        landing ke css/js
 *   dist/app/…           React app
 */

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const LANDING = ['index.html', 'assets', 'robots.txt', 'fonts'];

// public/ ka sab kuch waise ka waisa dist ki jad me (APK yahin se serve hoti hai)
const PUBLIC_DIR = 'public';

function run(cmd, cwd) {
  console.log(`→ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// 1. landing waise ka waisa
for (const item of LANDING) {
  const from = join(root, item);
  if (existsSync(from)) cpSync(from, join(dist, item), { recursive: true });
}

// 2. public/ (APK waghairah) — root pe
const pub = join(root, PUBLIC_DIR);
if (existsSync(pub)) cpSync(pub, dist, { recursive: true });

// 3. app build karo
// --omit=optional yahan mat lagana: rollup ka platform binary optional dep hai,
// uske bina `vite build` "Cannot find module @rollup/rollup-*" pe mar jata hai.
run('npm ci --no-audit --no-fund', join(root, 'app'));
run('npm run build', join(root, 'app'));
cpSync(join(root, 'app', 'dist'), join(dist, 'app'), { recursive: true });

// 4. landing ke css/js pe content-hash lagao.
//    Inka naam kabhi nahi badalta, isliye bina stamp ke browser purani file
//    pakde baith jata hai — ek baar aisa ho chuka hai, dobara nahi hona chahiye.
const indexPath = join(dist, 'index.html');
if (existsSync(indexPath)) {
  const stamp = (rel) => {
    const file = join(dist, rel);
    return existsSync(file)
      ? createHash('md5').update(readFileSync(file)).digest('hex').slice(0, 8)
      : null;
  };

  let html = readFileSync(indexPath, 'utf8');
  const cssV = stamp('assets/css/site.css');
  const jsV = stamp('assets/js/site.js');

  if (cssV) html = html.replace(/\/assets\/css\/site\.css(\?v=[a-f0-9]+)?/g, `/assets/css/site.css?v=${cssV}`);
  if (jsV) html = html.replace(/\/assets\/js\/site\.js(\?v=[a-f0-9]+)?/g, `/assets/js/site.js?v=${jsV}`);

  writeFileSync(indexPath, html);
  console.log(`→ cache stamp: css ${cssV} · js ${jsV}`);
}

console.log('\n✓ dist/ taiyar hai — landing + /app');
