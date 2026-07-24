/**
 * App lock — 4 ank ka PIN.
 *
 * Email verification ki jagah ye hai, aur wajah seedhi hai: email ka vaada tha
 * "hisaab kabhi na khoye", par sync abhi bana hi nahi — matlab wo vaada jhootha
 * tha. PIN wo cheez karta hai jo sach me ho sakti hai: bhai ya dost ko phone
 * diya to tumhara hisaab unhe na dikhe.
 *
 * Poora offline. Koi server, koi email, koi doosri site nahi.
 *
 * PIN seedha nahi rakha jata — uska SHA-256 rakha jata hai, ek random salt ke
 * saath. Koi phone ka storage khol bhi le to usme PIN nahi milega. Ye bank
 * jaisi suraksha nahi hai (4 ank to waise bhi 10,000 hi hote hain), par
 * "saamne wala bina puche khol ke dekh le" — usse bachata hai, aur asli
 * khatra yahi hai.
 */

const KEY = 'hisaabi-lock';

interface Lock {
  salt: string;
  hash: string;
  /** galat PIN lagatar kitni baar — 5 ke baad thoda rukna padta hai */
  fails: number;
  lockedUntil?: number;
}

const MAX_FAILS = 5;
const COOLDOWN_MS = 30_000;

function read(): Lock | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Lock) : null;
  } catch {
    return null;
  }
}

function write(lock: Lock | null): void {
  if (lock) localStorage.setItem(KEY, JSON.stringify(lock));
  else localStorage.removeItem(KEY);
}

export function hasLock(): boolean {
  return read() !== null;
}

async function hash(pin: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function setLock(pin: string): Promise<void> {
  const salt = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  write({ salt, hash: await hash(pin, salt), fails: 0 });
}

export function removeLock(): void {
  write(null);
}

export interface UnlockResult {
  ok: boolean;
  /** kitni koshish bachi hai — 0 matlab thodi der rukna padega */
  left?: number;
  waitMs?: number;
}

/**
 * PIN jaancho.
 *
 * 5 galat koshish ke baad 30 second ka intezaar. Bina iske koi baitha-baitha
 * 10,000 combination try kar sakta hai — 4 ank me utne hi hote hain.
 */
export async function unlock(pin: string): Promise<UnlockResult> {
  const lock = read();
  if (!lock) return { ok: true };

  if (lock.lockedUntil && Date.now() < lock.lockedUntil) {
    return { ok: false, waitMs: lock.lockedUntil - Date.now() };
  }

  if (await hash(pin, lock.salt) === lock.hash) {
    write({ ...lock, fails: 0, lockedUntil: undefined });
    return { ok: true };
  }

  const fails = lock.fails + 1;
  if (fails >= MAX_FAILS) {
    write({ ...lock, fails: 0, lockedUntil: Date.now() + COOLDOWN_MS });
    return { ok: false, waitMs: COOLDOWN_MS };
  }

  write({ ...lock, fails });
  return { ok: false, left: MAX_FAILS - fails };
}
