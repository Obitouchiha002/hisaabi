/**
 * Website (static) + app (Vite) → ek `dist/` folder, jo Vercel serve karta hai.
 *
 *   dist/index.html      landing
 *   dist/assets/…        landing ke css/js
 *   dist/app/…           React app
 */

import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const LANDING = ['index.html', 'assets', 'robots.txt'];

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

console.log('\n✓ dist/ taiyar hai — landing + /app');
