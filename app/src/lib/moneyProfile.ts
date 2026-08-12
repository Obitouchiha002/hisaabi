/**
 * Money profile — user ki paise-situation (income, needs, loan, goal…).
 * localStorage me rehti hai (offline, koi backend nahi). Engine ka
 * buildMoneyPlan isi ko padh kar plan banata hai.
 */

import { bucketForCategory, isCounted, monthRange, type Entry, type MoneyPlan, type MoneyProfile } from '@engine';

const KEY = 'hisaabi-money';
const GUARD_KEY = 'hisaabi-guardrail';

/** Overspend pe app kitna sakht — user chunta hai. */
export type Guardrail = 'soft' | 'strict';

export function getGuardrail(): Guardrail {
  return localStorage.getItem(GUARD_KEY) === 'strict' ? 'strict' : 'soft';
}
export function setGuardrail(g: Guardrail): void {
  localStorage.setItem(GUARD_KEY, g);
}

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
    if (e.status !== 'confirmed') continue;
    if (e.type !== 'expense' && e.type !== 'refund') continue;
    if (isCounted(e) === false) continue; // failed/pending nahi ginte
    const at = new Date(e.occurredAt).getTime();
    if (at < from.getTime() || at > to.getTime()) continue;
    const b = bucketForCategory(e.category ?? 'other');
    const delta = e.type === 'refund' ? -e.amountPaise : e.amountPaise; // refund kharcha ghatata hai
    out[b] = Math.max(0, out[b] + delta);
    out.total = Math.max(0, out.total + delta);
  }
  return out;
}

/** Aaj plan ke hisaab se kahan khade hain — Home pe dikhane ke liye. */
export interface PlanPulse {
  funAllottedPaise: number;
  funSpentPaise: number;
  funLeftPaise: number;         // 0 se kam nahi
  overspentPaise: number;       // fun se kitna upar (0 = theek)
  daysLeft: number;             // is mahine ke bache din (aaj sameत)
  safePerDayPaise: number;      // funLeft / daysLeft
}

export function planPulse(plan: MoneyPlan, entries: Entry[], now = new Date()): PlanPulse {
  const spend = monthlyBucketSpend(entries, now);
  const fun = plan.buckets.find((b) => b.id === 'fun')?.allocatedPaise ?? 0;
  const funLeft = Math.max(0, fun - spend.fun);
  const overspent = Math.max(0, spend.fun - fun);

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1);

  return {
    funAllottedPaise: fun,
    funSpentPaise: spend.fun,
    funLeftPaise: funLeft,
    overspentPaise: overspent,
    daysLeft,
    safePerDayPaise: Math.floor(funLeft / daysLeft),
  };
}
