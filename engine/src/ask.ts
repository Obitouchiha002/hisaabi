/**
 * "Poocho kuch bhi" ka planner.
 *
 * Sawaal → QueryPlan (JSON). Bas. Jawab ka number yahan se nahi aata —
 * wo query.ts database pe chala ke nikalta hai. AI kabhi total nahi batata.
 */

import type { CategoryId, EntryType, PaidWith } from './types.js';

export type Metric = 'sum' | 'count' | 'avg' | 'max' | 'list';

export type RangeLabel =
  | 'today' | 'yesterday' | 'this_week' | 'last_week'
  | 'this_month' | 'last_month' | 'this_year' | 'all_time';

export interface QueryPlan {
  metric: Metric;
  filter: {
    /** merchant ya title me ye text hona chahiye */
    text?: string;
    category?: CategoryId;
    type?: EntryType;
    paidWith?: PaidWith;
  };
  range: { label: RangeLabel; from: string; to: string };
  compareToPrevious?: boolean;
  groupBy?: 'category' | 'merchant' | 'day';
}

const RANGE_PATTERNS: Array<[RegExp, RangeLabel]> = [
  [/\bparso\b/i, 'yesterday'],
  [/\bkal\b|yesterday/i, 'yesterday'],
  [/\baaj\b|today|abhi tak/i, 'today'],
  [/pich?h?le hafte|last week|guzre hafte/i, 'last_week'],
  [/is hafte|this week|hafte me|weekly/i, 'this_week'],
  [/pich?h?le mahine|last month|guzre mahine/i, 'last_month'],
  [/is mahine|this month|mahine me|monthly/i, 'this_month'],
  [/is saal|this year|saal me/i, 'this_year'],
  [/ab tak|total|kul milakar|all time|hamesha/i, 'all_time'],
];

const METRIC_PATTERNS: Array<[RegExp, Metric]> = [
  [/kitne\s+(baar|bar|order|orders|transaction|entries|entry)|how many|count/i, 'count'],
  [/sabse\s+(bada|badi|zyada|jyada|mehenga|mehnga)|biggest|largest|highest/i, 'max'],
  [/average|rozana|per day|avg|औसत/i, 'avg'],
  [/dikha|dikhao|list|kaunse|konse|kaha kaha|show me|batao kaun/i, 'list'],
];

/** Filter ke liye jaane-pehchane naam. Title me bhi match hote hain, isliye "chai" bhi chalega. */
const KNOWN_TERMS = [
  'swiggy', 'zomato', 'blinkit', 'zepto', 'instamart', 'bigbasket', 'dmart',
  'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa',
  'uber', 'ola', 'rapido', 'auto', 'petrol', 'diesel', 'irctc', 'metro',
  'jio', 'airtel', 'vodafone', 'recharge', 'bijli', 'electricity',
  'netflix', 'spotify', 'hotstar', 'prime', 'bookmyshow',
  'chai', 'sabzi', 'doodh', 'khana', 'nashta', 'sigret', 'cigarette',
  'dominos', 'kfc', 'mcdonald', 'starbucks', 'cred', 'phonepe', 'paytm', 'gpay',
  'rent', 'kiraya', 'emi', 'medicine', 'dawa', 'hospital',
];

const CATEGORY_TERMS: Array<[RegExp, CategoryId]> = [
  [/khane|khana|food|khana-peena|restaurant/i, 'food'],
  [/grocery|ghar ka saman|kirana|rashan/i, 'grocery'],
  [/travel|aana-jaana|safar|transport|petrol/i, 'travel'],
  [/bill|recharge/i, 'bills'],
  [/shopping|kapde|kapda/i, 'shopping'],
  [/sehat|health|medical|dawa/i, 'health'],
  [/kiraya|rent/i, 'rent'],
  [/padhai|education|fees/i, 'education'],
  [/masti|fun|movie|entertainment/i, 'fun'],
];

/**
 * Rule-based planner. Samajh na aaye to null — tab app AI adapter se plan mangwati hai.
 */
export function planQuery(question: string, now: Date = new Date()): QueryPlan | null {
  const q = question.toLowerCase().trim();
  if (!q) return null;

  const isMoneyQuestion =
    /kitna|kitne|kharch|kharcha|gaya|spent|total|sabse|dikha|list|average|paisa|bacha/i.test(q);
  if (!isMoneyQuestion) return null;

  let metric: Metric = 'sum';
  for (const [re, m] of METRIC_PATTERNS) {
    if (re.test(q)) { metric = m; break; }
  }

  let label: RangeLabel = 'this_month';
  for (const [re, l] of RANGE_PATTERNS) {
    if (re.test(q)) { label = l; break; }
  }

  const filter: QueryPlan['filter'] = { type: 'expense' };

  const term = KNOWN_TERMS.find((t) => new RegExp(`\\b${t}`, 'i').test(q));
  if (term) filter.text = term;

  if (!term) {
    for (const [re, cat] of CATEGORY_TERMS) {
      if (re.test(q)) { filter.category = cat; break; }
    }
  }

  if (/cash|nakad/i.test(q)) filter.paidWith = 'cash';

  const range = resolveRange(label, now);
  const compareToPrevious =
    /se zyada|se kam|compare|pich?h?le .* se|kitna zyada/i.test(q) ||
    (metric === 'sum' && (label === 'this_month' || label === 'this_week'));

  return { metric, filter, range, compareToPrevious };
}

export function resolveRange(label: RangeLabel, now: Date = new Date()): QueryPlan['range'] {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  let from: Date;
  let to: Date;

  switch (label) {
    case 'today':
      from = startOfDay(now); to = endOfDay(now); break;
    case 'yesterday': {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      from = startOfDay(y); to = endOfDay(y); break;
    }
    case 'this_week': {
      const d = new Date(now);
      const dow = (d.getDay() + 6) % 7; // somvaar = 0
      d.setDate(d.getDate() - dow);
      from = startOfDay(d); to = endOfDay(now); break;
    }
    case 'last_week': {
      const d = new Date(now);
      const dow = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - dow - 7);
      const end = new Date(d); end.setDate(end.getDate() + 6);
      from = startOfDay(d); to = endOfDay(end); break;
    }
    case 'last_month':
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    case 'this_year':
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      to = endOfDay(now);
      break;
    case 'all_time':
      from = new Date(2000, 0, 1);
      to = endOfDay(now);
      break;
    case 'this_month':
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      to = endOfDay(now);
      break;
  }

  return { label, from: from.toISOString(), to: to.toISOString() };
}

/** Pichhla barabar ka period — "pichhle mahine se ₹900 zyada" ke liye. */
export function previousRange(range: QueryPlan['range']): { from: string; to: string } {
  const from = new Date(range.from);
  const to = new Date(range.to);
  const span = to.getTime() - from.getTime();

  if (range.label === 'this_month' || range.label === 'last_month') {
    const pf = new Date(from.getFullYear(), from.getMonth() - 1, 1, 0, 0, 0, 0);
    const pt = new Date(from.getFullYear(), from.getMonth(), 0, 23, 59, 59, 999);
    return { from: pf.toISOString(), to: pt.toISOString() };
  }

  return {
    from: new Date(from.getTime() - span - 1).toISOString(),
    to: new Date(from.getTime() - 1).toISOString(),
  };
}

export const RANGE_LABELS_HI: Record<RangeLabel, string> = {
  today: 'aaj',
  yesterday: 'kal',
  this_week: 'is hafte',
  last_week: 'pichhle hafte',
  this_month: 'is mahine',
  last_month: 'pichhle mahine',
  this_year: 'is saal',
  all_time: 'ab tak',
};

/* ============================================================
   Intent — user ne kharcha likha hai ya sawaal pucha hai?
   User ko ye sochna hi nahi chahiye ki kaunsa button dabana hai.
   ============================================================ */

export type Intent = 'expense' | 'question' | 'trip' | 'unknown';

/**
 * "4 dost Goa ja rahe hain, budget das hazaar" — ye kharcha nahi, trip ka plan hai.
 * Do cheezein saath honi chahiye: log (dost/hum/humlog/naam) aur jaana/trip/party.
 */
const TRIP_RE =
  /\b(trip|tour|outing|picnic|party|ghumne|ghoomne|jaana hai|ja rahe|jaa rahe|jaayenge|jayenge|nikal rahe|plan hai|plan kar)\b/i;

const PEOPLE_RE =
  /\b(dost|dosto|doston|yaar|yaaron|log|logon|hum|humlog|hamlog|banda|bande|friends|couple|family|ghar wale|ke saath|sabke saath)\b/i;

export function looksLikeTrip(text: string): boolean {
  if (!TRIP_RE.test(text)) return false;
  if (PEOPLE_RE.test(text)) return true;
  // "Rahul Aman ke saath Goa" — do naam bhi log hi hain
  return (text.match(/\b[A-Z][a-z]{2,12}\b/g) ?? []).length >= 2;
}

/** Sawaal ke pakke ishare. */
const QUESTION_RE =
  /\?|\b(kitna|kitne|kitni|kaha|kahan|kaun|kaunsa|konsa|kab|kyun|batao|bata|dikha|dikhao|list|report|summary|total|average|sabse|compare|bacha|bachega|safe|kya\s+hai|how much|how many|what|which|when|show)\b/i;

/**
 * Kharcha likhne ke ishare — sirf kriya (verb), naam (noun) nahi.
 * "kharche" jaisa noun sawaal me bhi aata hai: "kaunse kharche the?"
 */
const EXPENSE_RE =
  /\b(kiya|kiye|diya|diye|liya|liye|lagaye|laga|khareeda|kharida|bhara|dala|khaya|piya|paid|spent|bought)\b/i;

/** "?" ya saaf sawaal wale shabd — inke aage kuch nahi chalta. */
const STRONG_QUESTION_RE =
  /\?|\b(kitna|kitne|kitni|kaunsa|kaunse|konsa|konse|kahan|kaha|kab|kyun|batao|dikhao|report|summary|how much|how many|which|show me)\b/i;

/**
 * Text kharcha hai ya sawaal.
 *
 * Sabse bada ishara: amount hai ya nahi. Sawaal me aksar amount nahi hota
 * ("swiggy pe kitna gaya"), aur kharche me hamesha hota hai ("swiggy 300").
 * Dono ho — "is mahine 500 se zyada kaunse kharche" — to sawaal wale
 * shabd bhaari padte hain.
 */
export function detectIntent(text: string, hasAmount: boolean): Intent {
  const t = text.trim();
  if (!t) return 'unknown';

  // Trip pehle — "4 dost Goa ja rahe hain budget das hazaar" me amount bhi hai,
  // par wo kharcha nahi, trip ka budget hai.
  if (looksLikeTrip(t)) return 'trip';

  // "?" ya "kitna/kaunsa" — amount ho tab bhi sawaal hi hai
  if (STRONG_QUESTION_RE.test(t)) return 'question';

  const looksLikeQuestion = QUESTION_RE.test(t);
  const looksLikeExpense = EXPENSE_RE.test(t);

  if (looksLikeQuestion && !looksLikeExpense) return 'question';

  if (hasAmount) return 'expense';
  if (looksLikeQuestion) return 'question';
  if (looksLikeExpense) return 'expense';

  return 'unknown';
}
