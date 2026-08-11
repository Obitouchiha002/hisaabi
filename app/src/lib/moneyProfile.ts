/**
 * Money profile — user ki paise-situation (income, needs, loan, goal…).
 * localStorage me rehti hai (offline, koi backend nahi). Engine ka
 * buildMoneyPlan isi ko padh kar plan banata hai.
 */

import { bucketForCategory, monthRange, type Entry, type MoneyProfile } from '@engine';

const KEY = 'hisaabi-money';

export function loadMoneyProfile(): MoneyProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MoneyProfile) : null;
  } catch {
    return null;
  }
}

export function saveMoneyProfile(p: MoneyProfile): void {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function clearMoneyProfile(): void {
  localStorage.removeItem(KEY);
}

/** Naye profile ka khaali khaka. */
export function blankProfile(): MoneyProfile {
  return {
    incomePaise: 0,
    fixedNeedsPaise: 0,
    loans: [],
    dependents: 0,
    incomeStability: 'stable',
    hasHealthInsurance: false,
    emergencyFundPaise: 0,
    goal: undefined,
  };
}

/**
 * Is mahine har bucket me kitna kharch hua — plan se milane ke liye.
 * needs / fun / other buckets me expenses ka jod.
 */
export function monthlyBucketSpend(entries: Entry[], now = new Date()): { needs: number; fun: number; other: number; total: number } {
  const { from, to } = monthRange(now);
  const out = { needs: 0, fun: 0, other: 0, total: 0 };
  for (const e of entries) {
    if (e.status !== 'confirmed' || e.type !== 'expense') continue;
    const at = new Date(e.occurredAt).getTime();
    if (at < from.getTime() || at > to.getTime()) continue;
    const b = bucketForCategory(e.category ?? 'other');
    out[b] += e.amountPaise;
    out.total += e.amountPaise;
  }
  return out;
}
