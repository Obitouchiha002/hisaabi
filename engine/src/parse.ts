/**
 * Text (bola hua ya likha hua) → DraftEntry[].
 *
 * Rule parser hi pehli line of defence hai — "chai 20", "auto saath" jaise
 * ~70% cases yahin nipat jate hain, bina kisi AI call ke.
 */

import type { DraftEntry, EngineContext, EntryType, InputSource, PaidWith, DraftWarning } from './types.js';
import { extractAmount } from './numbers.js';
import { cleanTitle, normalize, splitSegments, titleCase } from './normalize.js';
import { toPaise } from './money.js';

const INCOME_RE = /\b(mila|mili|milay|aaya|aayi|salary|tankhwah|income|credited|credit|received|refund|wapas|return)\b/i;
const CASH_IN_RE = /\b(atm|nikale|nikala|nikali|nikal|withdraw|withdrawn|withdrawal)\b/i;
const CASH_RE = /\b(cash|nakad|nagad)\b/i;
const DIGITAL_RE = /\b(upi|gpay|g pay|phonepe|phone pe|paytm|card|online|net ?banking|bhim)\b/i;

/** ₹1 se kam ya ₹5,00,000 se zyada — kuch to gadbad hai */
const MIN_PAISE = 100;
const LARGE_PAISE = 50_000_00;

export interface ParseOptions extends EngineContext {
  source?: InputSource;
  /** voice transcript ka apna confidence (0..1), agar STT deta ho */
  transcriptConfidence?: number;
}

export function parseText(input: string, opts: ParseOptions = {}): DraftEntry[] {
  const now = opts.now ?? new Date();
  const source: InputSource = opts.source ?? 'manual';
  const text = normalize(input);
  if (!text) return [];

  const segments = splitSegments(text);
  const drafts: DraftEntry[] = [];

  for (const segment of segments) {
    const draft = parseSegment(segment, { ...opts, source, now });
    if (draft) drafts.push(draft);
  }

  return drafts;
}

function parseSegment(segment: string, opts: ParseOptions & { source: InputSource; now: Date }): DraftEntry | null {
  const hit = extractAmount(segment);
  if (!hit) return null;

  const amountPaise = toPaise(hit.value);
  if (amountPaise < MIN_PAISE) return null;

  const warnings: DraftWarning[] = [];
  const rest = segment.replace(hit.matchedText, ' ');
  const cleaned = cleanTitle(rest);

  let type: EntryType = 'expense';
  if (CASH_IN_RE.test(segment)) type = 'cash_in';
  else if (INCOME_RE.test(segment)) type = 'income';

  let paidWith: PaidWith = opts.defaultPaidWith ?? 'cash';
  if (type === 'cash_in') paidWith = 'cash';
  else if (DIGITAL_RE.test(segment)) paidWith = 'digital';
  else if (CASH_RE.test(segment)) paidWith = 'cash';

  let title = titleCase(cleaned);
  if (!title) {
    title = type === 'cash_in' ? 'ATM se nikala' : type === 'income' ? 'Aamdani' : 'Kharcha';
    if (type === 'expense') warnings.push('title_missing');
  }

  let confidence = hit.kind === 'digits' ? 0.92 : 0.78;
  if (warnings.includes('title_missing')) confidence -= 0.2;
  if (cleaned.split(/\s+/).filter(Boolean).length > 5) confidence -= 0.08;
  if (opts.transcriptConfidence != null) {
    confidence = confidence * (0.55 + 0.45 * clamp01(opts.transcriptConfidence));
  }
  if (amountPaise > LARGE_PAISE) warnings.push('large_amount');
  if (hit.kind === 'words') warnings.push('amount_uncertain');

  return {
    title,
    amountPaise,
    type,
    paidWith,
    occurredAt: opts.now.toISOString(),
    source: opts.source,
    confidence: round2(clamp01(confidence)),
    warnings,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
