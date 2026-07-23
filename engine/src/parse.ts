/**
 * Text (bola hua ya likha hua) → DraftEntry[].
 *
 * Rule parser hi pehli line of defence hai — "chai 20", "auto saath" jaise
 * ~70% cases yahin nipat jate hain, bina kisi AI call ke.
 */

import type { DraftEntry, EngineContext, EntryType, InputSource, PaidWith, DraftWarning } from './types.js';
import { extractAmount, findAmountSpans } from './numbers.js';
import { cleanTitle, normalize, splitSegments, titleCase } from './normalize.js';
import { toPaise } from './money.js';
import { extractWhen, resolveWhen, stripWhen, type WhenHit } from './when.js';

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

  const drafts: DraftEntry[] = [];

  // "aaj subah… kal raat…" — waqt ek baar bola jaye to aage ke kharchon pe bhi
  // wahi lagta hai, jab tak naya waqt na aaye. Log aise hi baat karte hain.
  let carriedWhen: WhenHit | null = null;

  for (const segment of splitSegments(text)) {
    // Bolte waqt koi comma nahi lagata — "chai bees auto saath" ek hi segment
    // aata hai par usme DO kharche hain. Isliye amount ki jagah dekh kar bhi todte hain.
    for (const piece of splitByAmounts(segment)) {
      const when = extractWhen(piece);
      if (when) carriedWhen = when;

      const draft = parseSegment(piece, { ...opts, source, now, when: when ?? carriedWhen });
      if (draft) drafts.push(draft);
    }
  }

  return drafts;
}

/** Ye shabd batate hain ki amount pehle aaya aur naam baad me: "bees ki chai" */
const AMOUNT_FIRST = new Set(['ka', 'ki', 'ke', 'wala', 'wali', 'wale']);

/**
 * Ek segment me kai amount hon to use tod do.
 *
 *   "chai bees auto saath sabzi ek sau chalis"
 *      → ["chai bees", "auto saath", "sabzi ek sau chalis"]
 *
 * Naam amount se pehle bhi ho sakta hai aur baad me bhi:
 *   "chai bees"      → naam pehle
 *   "bees ki chai"   → naam baad me (ka/ki/ke se pata chalta hai)
 */
export function splitByAmounts(segment: string): string[] {
  const tokens = segment.split(/\s+/).filter(Boolean);
  const spans = findAmountSpans(tokens);

  // ek ya koi amount nahi — todne ki zaroorat hi nahi
  if (spans.length < 2) return [segment];

  const pieces: string[] = [];
  let cursor = 0;

  spans.forEach((span, i) => {
    let end = span.end;

    // "bees ki chai" — amount ke baad ka/ki/ke aaye to naam bhi isi ka hai
    const next = spans[i + 1];
    if (AMOUNT_FIRST.has((tokens[span.end] ?? '').toLowerCase())) {
      end = next ? next.start : tokens.length;
    } else if (!next) {
      end = tokens.length;   // aakhri tukde me bacha hua sab shaamil
    }

    const piece = tokens.slice(cursor, end).join(' ').trim();
    if (piece) pieces.push(piece);
    cursor = end;
  });

  return pieces.length ? pieces : [segment];
}

function parseSegment(
  segment: string,
  opts: ParseOptions & { source: InputSource; now: Date; when?: WhenHit | null },
): DraftEntry | null {
  const hit = extractAmount(segment);
  if (!hit) return null;

  const amountPaise = toPaise(hit.value);
  if (amountPaise < MIN_PAISE) return null;

  const warnings: DraftWarning[] = [];
  const rest = stripWhen(segment.replace(hit.matchedText, ' '), opts.when ?? null);
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
    occurredAt: resolveWhen(opts.when ?? null, opts.now).toISOString(),
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
