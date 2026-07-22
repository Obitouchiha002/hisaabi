/**
 * Duplicate detection.
 *
 * Asli case: user ne bola "blinkit do sau chalis" AUR PhonePe ka notification bhi aaya.
 * Dono ek hi transaction hain — do entries nahi banni chahiye.
 *
 * HARD RULE: amount alag hai to duplicate ho hi nahi sakta (score 0).
 */

import type { DraftEntry, DuplicateMatch, Entry } from './types.js';
import { merchantKey } from './normalize.js';

export const DUPLICATE_THRESHOLD = 0.75;

/** Itne minute purani entries hi check hoti hain. */
export const DUPLICATE_WINDOW_MIN = 60;

export function duplicateScore(a: DraftEntry, b: Entry): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  if (a.amountPaise !== b.amountPaise) return { score: 0, reasons: [] };
  if (a.type !== b.type) return { score: 0, reasons: [] };

  // same transaction ref → pakka duplicate
  if (a.ref && b.ref && a.ref === b.ref) {
    return { score: 1, reasons: ['same reference'] };
  }

  let score = 0.5;
  reasons.push('same amount');

  const gapMin = Math.abs(new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()) / 60000;
  if (gapMin <= 3) { score += 0.3; reasons.push('3 min ke andar'); }
  else if (gapMin <= 10) { score += 0.2; reasons.push('10 min ke andar'); }
  else if (gapMin <= 30) { score += 0.05; reasons.push('30 min ke andar'); }
  else if (gapMin > DUPLICATE_WINDOW_MIN) return { score: 0, reasons: [] };

  const ka = merchantKey(a.merchant ?? a.title);
  const kb = merchantKey(b.merchant ?? b.title);
  if (ka && kb) {
    if (ka === kb) { score += 0.2; reasons.push('same dukaan'); }
    else if (ka.includes(kb) || kb.includes(ka)) { score += 0.1; reasons.push('milta-julta naam'); }
  }

  // alag raste se aaya same transaction — yahi to asli duplicate case hai
  if (a.source !== b.source) { score += 0.05; reasons.push('alag source'); }

  return { score: Math.min(1, Math.round(score * 100) / 100), reasons };
}

export function findDuplicates(draft: DraftEntry, recent: Entry[]): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  for (const entry of recent) {
    if (entry.status === 'ignored' || entry.status === 'duplicate') continue;
    const { score, reasons } = duplicateScore(draft, entry);
    if (score >= DUPLICATE_THRESHOLD) {
      matches.push({ entryId: entry.id, score, reasons });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}
