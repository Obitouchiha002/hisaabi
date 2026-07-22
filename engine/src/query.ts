/**
 * QueryPlan → asli jawab. Poora deterministic — har number yahin se banta hai.
 */

import type { Entry, Paise } from './types.js';
import type { QueryPlan } from './ask.js';
import { previousRange, RANGE_LABELS_HI } from './ask.js';
import { categoryMeta } from './categories.js';
import { formatINR } from './money.js';
import { merchantKey } from './normalize.js';

export interface QueryResult {
  metric: QueryPlan['metric'];
  valuePaise: Paise;
  count: number;
  entries: Entry[];
  /** groupBy diya ho to */
  breakdown?: Array<{ key: string; label: string; valuePaise: Paise; count: number }>;
  previousValuePaise?: Paise;
}

export function runQuery(plan: QueryPlan, entries: Entry[]): QueryResult {
  const matched = filterEntries(plan, entries, plan.range.from, plan.range.to);

  const total = matched.reduce((s, e) => s + e.amountPaise, 0);
  let valuePaise = total;

  if (plan.metric === 'avg') {
    const days = Math.max(1, daysBetween(plan.range.from, plan.range.to));
    valuePaise = Math.round(total / days);
  } else if (plan.metric === 'max') {
    valuePaise = matched.reduce((m, e) => Math.max(m, e.amountPaise), 0);
  } else if (plan.metric === 'count') {
    valuePaise = 0;
  }

  const result: QueryResult = {
    metric: plan.metric,
    valuePaise,
    count: matched.length,
    entries: sortByAmountDesc(matched),
  };

  if (plan.groupBy) result.breakdown = groupEntries(matched, plan.groupBy);

  if (plan.compareToPrevious) {
    const prev = previousRange(plan.range);
    const prevMatched = filterEntries(plan, entries, prev.from, prev.to);
    result.previousValuePaise = prevMatched.reduce((s, e) => s + e.amountPaise, 0);
  }

  return result;
}

function filterEntries(plan: QueryPlan, entries: Entry[], fromISO: string, toISO: string): Entry[] {
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  const text = plan.filter.text?.toLowerCase();

  return entries.filter((e) => {
    if (e.status !== 'confirmed') return false;

    const at = new Date(e.occurredAt).getTime();
    if (at < from || at > to) return false;

    if (plan.filter.type && e.type !== plan.filter.type) return false;
    if (plan.filter.category && e.category !== plan.filter.category) return false;
    if (plan.filter.paidWith && e.paidWith !== plan.filter.paidWith) return false;

    if (text) {
      const hay = `${e.merchant ?? ''} ${e.title} ${e.note ?? ''}`.toLowerCase();
      if (!hay.includes(text)) return false;
    }

    return true;
  });
}

function groupEntries(entries: Entry[], by: 'category' | 'merchant' | 'day') {
  const map = new Map<string, { key: string; label: string; valuePaise: Paise; count: number }>();

  for (const e of entries) {
    let key: string;
    let label: string;

    if (by === 'category') {
      key = e.category ?? 'other';
      const meta = categoryMeta((e.category ?? 'other') as never);
      label = `${meta.emoji} ${meta.label}`;
    } else if (by === 'merchant') {
      key = merchantKey(e.merchant ?? e.title) || 'anya';
      label = e.merchant ?? e.title;
    } else {
      key = e.occurredAt.slice(0, 10);
      label = key;
    }

    const row = map.get(key) ?? { key, label, valuePaise: 0, count: 0 };
    row.valuePaise += e.amountPaise;
    row.count += 1;
    map.set(key, row);
  }

  return [...map.values()].sort((a, b) => b.valuePaise - a.valuePaise);
}

function sortByAmountDesc(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => b.amountPaise - a.amountPaise);
}

function daysBetween(fromISO: string, toISO: string): number {
  return Math.max(1, Math.round((new Date(toISO).getTime() - new Date(fromISO).getTime()) / 86400000));
}

/** Hinglish jawab — number hamesha result se, kabhi AI se nahi. */
export function answerText(plan: QueryPlan, result: QueryResult): string {
  const when = RANGE_LABELS_HI[plan.range.label];
  const what = plan.filter.text
    ? ` ${capitalize(plan.filter.text)} pe`
    : plan.filter.category
      ? ` ${categoryMeta(plan.filter.category).label} pe`
      : '';

  if (result.count === 0) {
    return `${capitalize(when)}${what} koi kharcha nahi mila.`;
  }

  if (plan.metric === 'count') {
    return `${capitalize(when)}${what} ${result.count} ${result.count === 1 ? 'kharcha' : 'kharche'} hue.`;
  }

  if (plan.metric === 'max') {
    const top = result.entries[0]!;
    return `${capitalize(when)}${what} sabse bada kharcha ${top.merchant ?? top.title} — ${formatINR(top.amountPaise)}.`;
  }

  if (plan.metric === 'avg') {
    return `${capitalize(when)}${what} rozana average ${formatINR(result.valuePaise)} raha.`;
  }

  if (plan.metric === 'list') {
    const top = result.entries.slice(0, 5)
      .map((e) => `${e.merchant ?? e.title} ${formatINR(e.amountPaise)}`)
      .join(', ');
    return `${capitalize(when)}${what} ${result.count} kharche: ${top}${result.count > 5 ? '…' : ''}`;
  }

  let line = `${capitalize(when)}${what} ${formatINR(result.valuePaise)} gaya — ${result.count} ${result.count === 1 ? 'kharcha' : 'kharche'}.`;

  if (result.previousValuePaise != null && result.previousValuePaise > 0) {
    const diff = result.valuePaise - result.previousValuePaise;
    if (Math.abs(diff) >= 100) {
      const prevLabel = plan.range.label === 'this_week' ? 'Pichhle hafte' : 'Pichhle mahine';
      line += ` ${prevLabel} se ${formatINR(Math.abs(diff))} ${diff > 0 ? 'zyada' : 'kam'}.`;
    }
  }

  return line;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
