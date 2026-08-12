/**
 * Streak / aana-jaana — coach ka personality isi pe chalta hai.
 * User roz aata hai to welcome, kuch din gayab to naraz. Sab is phone me.
 */
const KEY = 'hisaabi-streak';

interface StreakState {
  lastActive: string;   // YYYY-MM-DD
  greetedOn: string;    // is din greet dikha diya
  streak: number;       // lagataar kitne din
}

function ymd(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function read(): StreakState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StreakState) : null;
  } catch {
    return null;
  }
}
function write(s: StreakState): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

/** Do YYYY-MM-DD ke beech poore din. */
function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`).getTime();
  const db = new Date(`${b}T00:00:00`).getTime();
  return Math.round((db - da) / 86400000);
}

/** Aaj se pichhli visit kitne din pehle thi — naya user ho to null. */
export function peekGap(now = new Date()): number | null {
  const s = read();
  if (!s?.lastActive) return null;
  return daysBetween(s.lastActive, ymd(now));
}

/** Aaj greet dikha diya? */
export function greetedToday(now = new Date()): boolean {
  return read()?.greetedOn === ymd(now);
}

/** App khulte hi — aaj active maano, streak update karo. */
export function markActive(now = new Date()): void {
  const t = ymd(now);
  const s = read();
  let streak = 1;
  if (s?.lastActive) {
    const g = daysBetween(s.lastActive, t);
    streak = g === 0 ? (s.streak || 1) : g === 1 ? (s.streak || 0) + 1 : 1;
  }
  write({ lastActive: t, greetedOn: s?.greetedOn ?? '', streak });
}

/** Aaj ke liye greet ho gaya — mark kar do. */
export function markGreeted(now = new Date()): void {
  const s = read() ?? { lastActive: ymd(now), greetedOn: '', streak: 1 };
  write({ ...s, greetedOn: ymd(now) });
}

export function getStreak(): number {
  return read()?.streak ?? 0;
}
