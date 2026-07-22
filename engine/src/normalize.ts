/** Text safai — parse se pehle, aur AI ko bhejne se pehle. */

/** Filler shabd jo title me nahi hone chahiye. */
const FILLER = new Set([
  'aaj', 'kal', 'parso', 'subah', 'dopahar', 'shaam', 'sham', 'raat', 'abhi',
  'mene', 'maine', 'mein', 'me', 'mai', 'main', 'humne', 'hamne',
  'ka', 'ke', 'ki', 'ko', 'se', 'pe', 'par', 'pr', 'aur', 'or', 'and',
  'diye', 'diya', 'dia', 'lagaye', 'lage', 'laga', 'hua', 'hue', 'hui', 'gaya', 'gaye',
  'kharch', 'kharcha', 'kharche', 'kiya', 'kiye', 'karna', 'kar',
  'rupaye', 'rupaiya', 'rupee', 'rupees', 'rs', 'inr', 'rupya',
  'ho', 'gya', 'tha', 'the', 'thi', 'wala', 'wale', 'wali', 'ek',
  'spent', 'paid', 'for', 'on', 'at', 'the', 'a', 'an', 'of', 'i',
]);

/** Basic safai — lowercase, extra space, currency symbol ke aas-paas space. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/₹/g, ' ₹')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * PII hatao. Ye AI ko kuch bhejne se PEHLE chalna zaroori hai.
 * Notification kabhi AI ko jata hi nahi, phir bhi safety ke liye yahin rakha hai.
 */
export function scrubPII(text: string): string {
  return text
    // masked account: XXXXXX1234, xx1234, **1234
    .replace(/\b(?:[xX*]{2,}\s*)\d{2,}\b/g, '[acct]')
    // lamba digit run (account / card / phone)
    .replace(/\b\d{9,}\b/g, '[num]')
    // card: 4111 1111 1111 1111
    .replace(/\b(?:\d{4}[\s-]){3}\d{4}\b/g, '[card]')
    // ref no / txn id
    .replace(/\b(?:ref(?:erence)?|txn|utr|rrn)\s*(?:no\.?|id|#)?[:\s-]*[A-Za-z0-9]{6,}/gi, '[ref]')
    // OTP
    .replace(/\b(?:otp|code)\s*(?:is|:)?\s*\d{4,8}\b/gi, '[otp]')
    // UPI VPA ka user part chhupao, bank rakho
    .replace(/\b[\w.\-]{3,}@(ok\w+|[a-z]{2,})\b/gi, (m) => '[vpa]@' + m.split('@')[1])
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ek line me kai kharche → alag-alag segments. */
export function splitSegments(text: string): string[] {
  return text
    .split(/[,;|\n]|\baur\b|\bphir\b|\bthen\b|\band\b|\+/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Title banane ke liye filler hatao. */
export function cleanTitle(text: string): string {
  const words = text
    .replace(/[₹]/g, ' ')
    .replace(/[^\p{L}\p{N}\s&'.-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !FILLER.has(w.toLowerCase()))
    .filter((w) => !/^\d+$/.test(w));

  return words.slice(0, 6).join(' ').trim();
}

/** "hp pump" → "HP Pump", "swiggy" → "Swiggy" */
export function titleCase(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Merchant ko compare karne layak key me badlo. */
export function merchantKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|india|technologies|services|solutions|store|stores)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}
