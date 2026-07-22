/**
 * Hinglish / Hindi / English numbers → digits.
 *
 *   bees                → 20
 *   auto saath          → 60
 *   ek sau chalis       → 140
 *   dhai sau            → 250
 *   sava sau            → 125
 *   sadhe teen sau      → 350
 *   paune do sau        → 175
 *   dedh hazaar         → 1500
 */

/** English words alag rakhe hain — inpe spelling-guess nahi lagana (warna "ten" aur "teen" tak-ra jate hain). */
const ENGLISH_UNITS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
  thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};

const UNITS: Record<string, number> = {
  // 1–10
  ek: 1, do: 2, teen: 3, tin: 3, char: 4, chaar: 4, panch: 5, paanch: 5,
  chhe: 6, che: 6, chah: 6, chhah: 6, saat: 7, sat: 7, aath: 8, ath: 8,
  nau: 9, das: 10, dus: 10,
  // 11–19
  gyarah: 11, gyara: 11, barah: 12, bara: 12, terah: 13, tera: 13,
  chaudah: 14, chauda: 14, pandrah: 15, pandra: 15, solah: 16, sola: 16,
  satrah: 17, satra: 17, atharah: 18, athara: 18, unnis: 19, unis: 19,
  // tens
  bees: 20, bis: 20, tees: 30, tis: 30, chalis: 40, chaalis: 40,
  pachas: 50, pachaas: 50, pachhas: 50,
  sath: 60, saath: 60, sattar: 70, satar: 70,
  assi: 80, asi: 80, assee: 80, nabbe: 90, nabbey: 90, nabhe: 90,
  ...ENGLISH_UNITS,
};

const SCALES: Record<string, number> = {
  sau: 100, so: 100, hundred: 100,
  hazar: 1000, hazaar: 1000, hajar: 1000, thousand: 1000,
  lakh: 100000, lac: 100000, lakhs: 100000,
  crore: 10000000, karod: 10000000,
};

/** agle number pe lagne wale fractions: sava do = 2.25, sadhe teen = 3.5, paune do = 1.75 */
const FRACTIONS: Record<string, number> = {
  sava: 0.25, sawa: 0.25,
  sadhe: 0.5, sarhe: 0.5, saadhe: 0.5,
  paune: -0.25, pone: -0.25,
};

/** khud me poore number: dedh = 1.5, dhai = 2.5 */
const SPECIALS: Record<string, number> = {
  dedh: 1.5, derh: 1.5, dedhh: 1.5,
  dhai: 2.5, dhaai: 2.5, dhayi: 2.5, adhai: 2.5,
  aadha: 0.5, adha: 0.5, half: 0.5,
};

/**
 * Log jaisa bolte hain waisa hi likhte hain: "biss", "chaalees", "pachhaas", "assee".
 * Har spelling dictionary me daalna namumkin hai, isliye har shabd ka ek
 * canonical roop banate hain aur usse match karte hain:
 *
 *   bees → bis  ·  biss → bis  ·  chaalees → chalis  ·  pachhaas → pachas
 *
 * Do alag numbers ek hi canonical roop pe aa jayein (jaise angrezi "ten" aur hindi "teen"),
 * to wo roop index se hata dete hain — galat number lagne se accha hai na lage.
 */
function canon(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/(.)\1+/g, '$1')  // biss→bis, chaalees→chales, aath→ath
    .replace(/e/g, 'i')        // bees→bis, chales→chalis
    .replace(/o/g, 'u')
    .replace(/w/g, 'v');       // sawa→sava
}

function buildCanonIndex(...maps: Array<Record<string, number>>): Record<string, number> {
  const index: Record<string, number> = {};
  const clash = new Set<string>();

  for (const map of maps) {
    for (const [word, value] of Object.entries(map)) {
      const key = canon(word);
      if (!key) continue;
      if (key in index && index[key] !== value) { clash.add(key); continue; }
      index[key] = value;
    }
  }

  for (const key of clash) delete index[key];
  return index;
}

const CANON_UNITS = buildCanonIndex(UNITS);
const CANON_SCALES = buildCanonIndex(SCALES);
const CANON_FRACTIONS = buildCanonIndex(FRACTIONS);
const CANON_SPECIALS = buildCanonIndex(SPECIALS);

function lookup(map: Record<string, number>, canonMap: Record<string, number>, token: string): number | undefined {
  const t = token.toLowerCase();
  if (t in map) return map[t];
  const key = canon(t);
  return key ? canonMap[key] : undefined;
}

export function isNumberWord(token: string): boolean {
  return (
    lookup(UNITS, CANON_UNITS, token) !== undefined ||
    lookup(SCALES, CANON_SCALES, token) !== undefined ||
    lookup(FRACTIONS, CANON_FRACTIONS, token) !== undefined ||
    lookup(SPECIALS, CANON_SPECIALS, token) !== undefined
  );
}

/**
 * Number-words ke ek run ko number me badalta hai.
 * Koi number-word na mile to null.
 */
export function wordsToNumber(tokens: string[]): number | null {
  let total = 0;
  let current = 0;
  let fraction = 0;
  let matched = false;

  for (const raw of tokens) {
    const t = raw.toLowerCase();

    const frac = lookup(FRACTIONS, CANON_FRACTIONS, t);
    if (frac !== undefined) {
      fraction = frac;
      matched = true;
      continue;
    }

    const special = lookup(SPECIALS, CANON_SPECIALS, t);
    if (special !== undefined) {
      current = current === 0 ? special : current + special;
      matched = true;
      continue;
    }

    const unit = lookup(UNITS, CANON_UNITS, t);
    if (unit !== undefined) {
      let v = unit;
      if (fraction !== 0) { v += fraction; fraction = 0; }
      current = current === 0 ? v : current + v;
      matched = true;
      continue;
    }

    const scale = lookup(SCALES, CANON_SCALES, t);
    if (scale !== undefined) {
      let base = current === 0 ? 1 : current;
      if (fraction !== 0) { base += fraction; fraction = 0; }
      total += base * scale;
      current = 0;
      matched = true;
      continue;
    }

    // number-word nahi mila — run yahin khatam
    break;
  }

  if (!matched) return null;
  const value = total + current + (fraction !== 0 ? fraction : 0);
  return Math.round(value);
}

/**
 * Ye shabd number bhi hain aur aam bol-chaal ke shabd bhi:
 *   "add kar do"  → do = karo, 2 nahi
 *   "ek chai"     → ek = a/an, 1 nahi
 * Isliye akele aaye to amount nahi maane jate — "do sau" jaise jodon me chalte hain.
 */
const AMBIGUOUS_SINGLES = new Set(['do', 'ek', 'so', 'char', 'chaar']);

/** "saath" = 60, par "ke saath" = with. Aas-paas ke shabdon se pata chalta hai. */
const WITH_BEFORE = new Set(['ke', 'mere', 'tere', 'uske', 'apne', 'hamare', 'iske', 'unke', 'kiske']);
const WITH_AFTER = new Set(['me', 'mein', 'gaya', 'gaye', 'gayi', 'tha', 'the', 'thi', 'rehta', 'raha', 'hi']);

function isFalseNumberRun(run: string[], prev?: string, next?: string): boolean {
  if (run.length !== 1) return false;
  const word = run[0]!.toLowerCase();

  if (AMBIGUOUS_SINGLES.has(word)) return true;

  if (word === 'saath' || word === 'sath') {
    if (prev && WITH_BEFORE.has(prev.toLowerCase())) return true;
    if (next && WITH_AFTER.has(next.toLowerCase())) return true;
  }

  return false;
}

export interface AmountHit {
  /** rupees me (paise me convert karna caller ka kaam) */
  value: number;
  /** input ka wo hissa jo amount tha */
  matchedText: string;
  /** digits se mila ya shabdon se */
  kind: 'digits' | 'words';
}

/** ₹1,240.50 · Rs 500 · 500rs · 20/- · 1.2k */
const DIGIT_RE =
  /(?:₹|rs\.?|inr\.?)\s*(\d[\d,]*(?:\.\d{1,2})?)(k\b)?|(\d[\d,]*(?:\.\d{1,2})?)\s*(?:k\b|rs\b|rs\.|rupaye|rupaiya|rupees?|\/-)|\b(\d[\d,]*(?:\.\d{1,2})?)\b/gi;

/**
 * Ek line se amount nikalta hai.
 * Kai amount mile to sabse bada leta hai — "ek chai bees" me 20 chahiye, 1 nahi.
 */
export function extractAmount(text: string): AmountHit | null {
  const hits: AmountHit[] = [];

  for (const m of text.matchAll(DIGIT_RE)) {
    const digits = m[1] ?? m[3] ?? m[4];
    if (!digits) continue;
    let value = parseFloat(digits.replace(/,/g, ''));
    if (!isFinite(value)) continue;
    // "1.2k" / "2k"
    if (m[2] || /\d\s*k\b/i.test(m[0])) value *= 1000;
    hits.push({ value, matchedText: m[0].trim(), kind: 'digits' });
  }

  // shabdon wale numbers — sirf tab dekho jab digits na milein
  if (hits.length === 0) {
    const tokens = text.split(/\s+/).filter(Boolean);
    let i = 0;
    while (i < tokens.length) {
      if (!isNumberWord(tokens[i]!)) { i++; continue; }
      let j = i;
      while (j < tokens.length && isNumberWord(tokens[j]!)) j++;
      const run = tokens.slice(i, j);
      const value = isFalseNumberRun(run, tokens[i - 1], tokens[j]) ? null : wordsToNumber(run);
      if (value !== null && value > 0) {
        hits.push({ value, matchedText: run.join(' '), kind: 'words' });
      }
      i = j;
    }
  }

  if (hits.length === 0) return null;
  return hits.reduce((best, h) => (h.value > best.value ? h : best));
}
