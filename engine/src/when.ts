/**
 * "Kab hua" — text se date aur time nikalna.
 *
 * Log poore din ka haal ek saath sunate hain:
 *   "aaj subah chai bees, dopahar khana assi, kal raat zomato teen sau"
 *
 * Har kharche ke saath sahi waqt lagna zaroori hai, warna "aaj kitna gaya"
 * ka jawab hi galat ho jayega.
 */

export interface WhenHit {
  /** kitne din peeche — 0 = aaj, 1 = kal, 2 = parso */
  daysAgo: number;
  /** din ka hissa mila to uska ghanta (24h) */
  hour?: number;
  /** input ka wo hissa jo waqt bata raha tha — title se hatane ke liye */
  matched: string[];
}

/** Din ka hissa → aam waqt. "subah" bola to 9 baje maan lete hain. */
const PART_OF_DAY: Array<[RegExp, number]> = [
  [/\b(subah|savere|sawere|morning|nashte|breakfast)\b/i, 9],
  [/\b(dopahar|dopeher|lunch|afternoon)\b/i, 13],
  [/\b(shaam|sham|evening)\b/i, 18],
  [/\b(raat|rat|night|dinner)\b/i, 21],
];

const DAY_WORDS: Array<[RegExp, number]> = [
  [/\bparso\b/i, 2],
  [/\b(kal|yesterday)\b/i, 1],
  [/\b(aaj|today|abhi)\b/i, 0],
];

/** "5 baje", "saade 5 baje", "5:30 pe" */
const CLOCK_RE = /\b(\d{1,2})(?::(\d{2}))?\s*(?:baje|bje|pe|pm|am)\b/i;

/**
 * Text se waqt nikalo. Kuch na mile to null — matlab "abhi".
 *
 * Dhyan: "kal" ka matlab aane wala kal bhi hota hai, par kharcha likhte waqt
 * hamesha beeta hua kal hi hota hai. Isliye peeche hi jaate hain.
 */
export function extractWhen(text: string): WhenHit | null {
  const matched: string[] = [];
  let daysAgo: number | null = null;
  let hour: number | undefined;

  for (const [re, days] of DAY_WORDS) {
    const m = text.match(re);
    if (m) { daysAgo = days; matched.push(m[0]); break; }
  }

  for (const [re, h] of PART_OF_DAY) {
    const m = text.match(re);
    if (m) { hour = h; matched.push(m[0]); break; }
  }

  const clock = text.match(CLOCK_RE);
  if (clock?.[1]) {
    let h = parseInt(clock[1], 10);
    const isPm = /pm/i.test(clock[0]);
    // "5 baje" ke saath shaam/raat ho, ya pm likha ho → 17:00
    if ((isPm || hour === undefined ? false : hour >= 13) || isPm) {
      if (h < 12) h += 12;
    } else if (hour !== undefined && hour >= 13 && h < 12) {
      h += 12;
    }
    if (h >= 0 && h <= 23) { hour = h; matched.push(clock[0]); }
  }

  if (daysAgo === null && hour === undefined) return null;
  return { daysAgo: daysAgo ?? 0, hour, matched };
}

/** WhenHit → asli Date. */
export function resolveWhen(hit: WhenHit | null, now: Date): Date {
  if (!hit) return now;

  const d = new Date(now);
  d.setDate(d.getDate() - hit.daysAgo);

  if (hit.hour !== undefined) {
    d.setHours(hit.hour, 0, 0, 0);
    // aaj ka aisa waqt jo abhi aaya hi nahi — matlab kal ki baat ho rahi hai
    if (hit.daysAgo === 0 && d.getTime() > now.getTime()) {
      d.setDate(d.getDate() - 1);
    }
  }

  return d;
}

/** Waqt wale shabd title me nahi chahiye — "kal raat zomato" ka title sirf "Zomato". */
export function stripWhen(text: string, hit: WhenHit | null): string {
  if (!hit) return text;
  let out = text;
  for (const word of hit.matched) {
    out = out.replace(word, ' ');
  }
  return out.replace(/\s+/g, ' ').trim();
}
