/**
 * Safe-to-spend aur cash wallet.
 *
 * "Aaj kitna kharch safe hai" — app ka sabse kaam ka number. Isliye ye poora
 * deterministic hai; AI ka isme koi role nahi.
 */

import type { Entry, Paise } from './types.js';

export interface BudgetInput {
  monthlyBudgetPaise: Paise;
  /** is mahine ke confirmed kharche */
  spentThisMonthPaise: Paise;
  /** rent/EMI/subscription jo aana baaki hai */
  reservedBillsPaise?: Paise;
  now?: Date;
}

export interface SafeToSpend {
  leftPaise: Paise;
  daysLeft: number;
  perDayPaise: Paise;
  spentThisMonthPaise: Paise;
  status: 'good' | 'tight' | 'over';
  /** ab tak ka rozana average — comparison ke liye */
  avgPerDaySoFarPaise: Paise;
}

export function safeToSpend(input: BudgetInput): SafeToSpend {
  const now = input.now ?? new Date();
  const reserved = input.reservedBillsPaise ?? 0;

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysLeft = Math.max(1, daysInMonth - dayOfMonth + 1); // aaj bhi ginte hain

  const left = input.monthlyBudgetPaise - input.spentThisMonthPaise - reserved;
  const perDay = Math.floor(left / daysLeft);
  const avgSoFar = Math.floor(input.spentThisMonthPaise / Math.max(1, dayOfMonth));

  let status: SafeToSpend['status'] = 'good';
  if (perDay <= 0) status = 'over';
  else if (avgSoFar > 0 && perDay < avgSoFar * 0.6) status = 'tight';

  return {
    leftPaise: left,
    daysLeft,
    perDayPaise: Math.max(0, perDay),
    spentThisMonthPaise: input.spentThisMonthPaise,
    status,
    avgPerDaySoFarPaise: avgSoFar,
  };
}

/**
 * Cash wallet: ATM se aaya paisa minus cash me kiye kharche.
 * `cash_in` ko kabhi expense me mat ginna — warna mahina do baar count hoga.
 */
export function cashBalance(entries: Entry[]): Paise {
  let balance = 0;
  for (const e of entries) {
    if (e.status !== 'confirmed') continue;
    if (e.type === 'cash_in') balance += e.amountPaise;
    else if (e.type === 'expense' && e.paidWith === 'cash') balance -= e.amountPaise;
    else if (e.type === 'income' && e.paidWith === 'cash') balance += e.amountPaise;
  }
  return balance;
}

/** Mahine ka kharcha — cash_in aur income isme nahi jate. */
export function spentBetween(entries: Entry[], from: Date, to: Date): Paise {
  const f = from.getTime();
  const t = to.getTime();
  let total = 0;
  for (const e of entries) {
    if (e.status !== 'confirmed' || e.type !== 'expense') continue;
    const at = new Date(e.occurredAt).getTime();
    if (at >= f && at <= t) total += e.amountPaise;
  }
  return total;
}

export function monthRange(now: Date = new Date()): { from: Date; to: Date } {
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

export function dayRange(now: Date = new Date()): { from: Date; to: Date } {
  return {
    from: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
    to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
  };
}
