/**
 * Category engine + auto-learning.
 *
 * Priority: user ka seekha rule → merchant rule → keyword → AI (optional) → Anya
 */

import type { CategoryId, DraftEntry, LearnedRule } from './types.js';
import { merchantKey } from './normalize.js';

export interface CategoryMeta {
  id: CategoryId;
  label: string;   // Hinglish, kyunki app Hinglish me baat karti hai
  emoji: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'food',      label: 'Khana-peena',    emoji: '🍛' },
  { id: 'grocery',   label: 'Ghar ka saman',  emoji: '🛒' },
  { id: 'travel',    label: 'Aana-jaana',     emoji: '🛺' },
  { id: 'bills',     label: 'Bill & recharge', emoji: '📱' },
  { id: 'shopping',  label: 'Shopping',       emoji: '🛍️' },
  { id: 'health',    label: 'Sehat',          emoji: '💊' },
  { id: 'rent',      label: 'Kiraya',         emoji: '🏠' },
  { id: 'education', label: 'Padhai',         emoji: '📚' },
  { id: 'fun',       label: 'Masti',          emoji: '🎬' },
  { id: 'other',     label: 'Anya',           emoji: '📦' },
  { id: 'income',    label: 'Aamdani',        emoji: '💰' },
];

export function categoryMeta(id: CategoryId): CategoryMeta {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 2]!;
}

/** merchant / keyword → category. Order matters: pehla match jeetta hai. */
const RULES: Array<[RegExp, CategoryId]> = [
  [/swiggy|zomato|dominos|domino|pizza|kfc|mcdonald|burger|subway|starbucks|cafe|coffee|chai|tea|dhaba|restaurant|hotel|biryani|khana|nashta|breakfast|lunch|dinner|samosa|juice|thali|canteen|bakery|mithai|sweets/, 'food'],
  [/blinkit|zepto|instamart|bigbasket|dmart|d-mart|reliance fresh|more supermarket|grocery|kirana|sabzi|subzi|vegetable|fruit|doodh|milk|atta|aata|rashan|ration|provision|chini|cheeni|sugar|namak|salt|tel\b|oil|chawal|rice|\bdal\b|daal|masala|anda|ande|bread|maggi|paneer|dahi|ghee/, 'grocery'],
  [/uber|ola|rapido|auto|rickshaw|taxi|cab|petrol|diesel|fuel|hp\b|hpcl|iocl|indian oil|bharat petroleum|bpcl|irctc|redbus|abhibus|metro|bus|train|flight|indigo|vistara|toll|parking|namma yatri|yatri/, 'travel'],
  [/jio|airtel|vodafone|\bvi\b|bsnl|recharge|postpaid|prepaid|broadband|wifi|electricity|bijli|torrent power|adani electricity|tata power|gas|indane|hp gas|dth|tata sky|water bill|bill payment|insurance premium/, 'bills'],
  [/amazon|flipkart|myntra|ajio|meesho|nykaa|snapdeal|tatacliq|decathlon|lifestyle|pantaloons|westside|shopping|clothes|kapde|shoes|jute/, 'shopping'],
  [/apollo|pharmeasy|1mg|netmeds|tata 1mg|medplus|wellness|hospital|clinic|medical|pharmacy|chemist|dawa|dawai|medicine|doctor|lab|diagnostic|pathology/, 'health'],
  [/\brent\b|kiraya|landlord|maintenance|society charges|flat rent|pg rent/, 'rent'],
  [/school|college|university|tuition|coaching|fees|udemy|coursera|unacademy|byju|book|kitab|stationery|exam|padhai/, 'education'],
  [/netflix|prime video|hotstar|jiocinema|sony liv|zee5|spotify|gaana|wynk|youtube premium|bookmyshow|pvr|inox|cinema|movie|game|steam|playstation|party|club|bar\b/, 'fun'],
  [/salary|tankhwah|interest credited|dividend|refund|cashback received/, 'income'],
];

export interface CategoryResolution {
  category: CategoryId;
  source: 'learned' | 'merchant-rule' | 'keyword' | 'fallback';
  confidence: number;
}

/** Ek draft ke liye category nikalo. AI yahan nahi hai — wo app layer se aata hai. */
export function resolveCategory(
  draft: Pick<DraftEntry, 'title' | 'merchant' | 'type' | 'note'>,
  learned: LearnedRule[] = [],
): CategoryResolution {
  if (draft.type === 'income') {
    return { category: 'income', source: 'merchant-rule', confidence: 0.95 };
  }

  const keys = [draft.merchant, draft.title].filter(Boolean).map((s) => merchantKey(s!));

  // 1. user ne khud sikhaya
  for (const key of keys) {
    const rule = learned.find((r) => r.key === key && r.count >= 2);
    if (rule) return { category: rule.category, source: 'learned', confidence: 0.96 };
  }

  // 2 + 3. merchant / keyword rules
  const haystack = [draft.merchant, draft.title, draft.note].filter(Boolean).join(' ').toLowerCase();
  for (const [re, category] of RULES) {
    if (re.test(haystack)) {
      return {
        category,
        source: draft.merchant && re.test(draft.merchant.toLowerCase()) ? 'merchant-rule' : 'keyword',
        confidence: 0.85,
      };
    }
  }

  return { category: 'other', source: 'fallback', confidence: 0.3 };
}

/**
 * User ne category badli — yaad rakho.
 * 2 baar same correction ke baad rule apne aap lagne lagta hai.
 */
export function learnCategory(
  rules: LearnedRule[],
  key: string,
  category: CategoryId,
  now: Date = new Date(),
): LearnedRule[] {
  const k = merchantKey(key);
  if (!k) return rules;

  const next = rules.map((r) => ({ ...r }));
  const existing = next.find((r) => r.key === k);

  if (!existing) {
    next.push({ key: k, category, count: 1, updatedAt: now.toISOString() });
    return next;
  }

  if (existing.category === category) {
    existing.count += 1;
  } else {
    // user ne mann badla — count reset, nayi category se shuru
    existing.category = category;
    existing.count = 1;
  }
  existing.updatedAt = now.toISOString();
  return next;
}

/** Settings me dikhane ke liye: "Hisaabi ne kya seekha" */
export function activeRules(rules: LearnedRule[]): LearnedRule[] {
  return rules.filter((r) => r.count >= 2).sort((a, b) => b.count - a.count);
}

export function forgetRule(rules: LearnedRule[], key: string): LearnedRule[] {
  const k = merchantKey(key);
  return rules.filter((r) => r.key !== k);
}
