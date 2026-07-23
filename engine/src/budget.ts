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
  // poore rupee me — "₹442.30 /din" kisi ke kaam ka nahi
  const perDay = Math.floor(left / daysLeft / 100) * 100;
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
 *
 * Udhaar bhi jeb se jata/aata hai (kharcha na hone ke bawajood), isliye
 * cash wallet me wo bhi ginte hain — warna jeb ka hisaab galat dikhega.
 */
export function cashBalance(entries: Entry[]): Paise {
  let balance = 0;
  for (const e of entries) {
    if (e.status !== 'confirmed') continue;
    const cash = e.paidWith === 'cash';

    if (e.type === 'cash_in') balance += e.amountPaise;
    else if (e.type === 'expense' && cash) balance -= e.amountPaise;
    else if (e.type === 'income' && cash) balance += e.amountPaise;
    else if (e.type === 'lent' && cash) balance -= e.amountPaise;
    else if (e.type === 'borrowed' && cash) balance += e.amountPaise;
  }
  return balance;
}

/* ---------- lena-dena ---------- */

export interface UdhaarPerson {
  name: string;
  /** + matlab mujhe milna hai, − matlab mujhe dena hai */
  netPaise: Paise;
  entries: Entry[];
}

export interface UdhaarSummary {
  /** kul kitna mujhe milna hai */
  toGetPaise: Paise;
  /** kul kitna mujhe dena hai */
  toGivePaise: Paise;
  people: UdhaarPerson[];
}

/**
 * Kiska kitna baaki hai.
 *
 * Ek hi bande ke saath lena aur dena dono ho sakta hai — un dono ko jod kar
 * ek hi number dikhate hain, warna "Rahul se 500 lene, Rahul ko 300 dene"
 * jaisa bewajah confusion hota hai.
 */
export function udhaarSummary(entries: Entry[]): UdhaarSummary {
  const byPerson = new Map<string, UdhaarPerson>();

  for (const e of entries) {
    if (e.status !== 'confirmed') continue;
    if (e.type !== 'lent' && e.type !== 'borrowed') continue;
    if (e.settledAt) continue;   // chukta ho gaya

    const name = e.counterparty?.trim() || 'Koi';
    const row = byPerson.get(name) ?? { name, netPaise: 0, entries: [] };

    row.netPaise += e.type === 'lent' ? e.amountPaise : -e.amountPaise;
    row.entries.push(e);
    byPerson.set(name, row);
  }

  const people = [...byPerson.values()]
    .filter((p) => p.netPaise !== 0)
    .sort((a, b) => Math.abs(b.netPaise) - Math.abs(a.netPaise));

  return {
    toGetPaise: people.filter((p) => p.netPaise > 0).reduce((s, p) => s + p.netPaise, 0),
    toGivePaise: people.filter((p) => p.netPaise < 0).reduce((s, p) => s - p.netPaise, 0),
    people,
  };
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
