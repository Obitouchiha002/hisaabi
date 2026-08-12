/**
 * Paisa in hand — user ka asli current balance. Salary jab aaye tab aaye,
 * par "abhi mere paas itna hai" ek alag sach hai. Low-friction: jab chaaho
 * slider se update kar do. Sirf is phone me (localStorage).
 */
const KEY = 'hisaabi-balance';

export interface Balance {
  paise: number;
  updatedAt: string;   // ISO
}

export function getBalance(): Balance | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Balance) : null;
  } catch {
    return null;
  }
}

export function setBalance(paise: number, now = new Date()): Balance {
  const b: Balance = { paise: Math.max(0, Math.round(paise)), updatedAt: now.toISOString() };
  localStorage.setItem(KEY, JSON.stringify(b));
  return b;
}

/** "2 din pehle", "abhi" — kitni purani update hai. */
export function timeAgo(iso: string, now = new Date()): { en: string; hi: string } {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (mins < 2) return { en: 'just now', hi: 'abhi' };
  if (mins < 60) return { en: `${mins} min ago`, hi: `${mins} min pehle` };
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return { en: `${hrs}h ago`, hi: `${hrs} ghante pehle` };
  const days = Math.round(hrs / 24);
  return { en: `${days}d ago`, hi: `${days} din pehle` };
}
