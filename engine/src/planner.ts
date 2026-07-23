/**
 * Aage ka hisaab — projection aur planning.
 *
 * NIYAM: har number YAHAN banta hai, AI se kabhi nahi. AI sirf in numbers ko
 * padh kar Hinglish me salah likhta hai. Model se number mangwana matlab
 * user ko galat number dikhana — aur paise ke app me wo maafi layak nahi.
 */

import type { CategoryId, Entry, Paise } from './types.js';
import { categoryMeta } from './categories.js';
import { cashBalance, monthRange } from './budget.js';

export interface PlanInput {
  monthlyBudgetPaise: Paise;
  entries: Entry[];
  /** rent/EMI/subscription jo aana baaki hai */
  reservedBillsPaise?: Paise;
  now?: Date;
}

export interface CategorySlice {
  id: CategoryId;
  label: string;
  emoji: string;
  paise: Paise;
  /** kitne % kharche me isi ka hissa (0..1) */
  share: number;
  count: number;
  /** pichhle mahine isi category me kitna gaya tha */
  lastMonthPaise: Paise;
}

export interface PlanFacts {
  budgetPaise: Paise;
  spentPaise: Paise;
  leftPaise: Paise;
  reservedPaise: Paise;

  dayOfMonth: number;
  daysInMonth: number;
  daysLeft: number;

  /** ab tak ka rozana average */
  burnPerDayPaise: Paise;
  /** isi raftaar se chalte rahe to mahine ke aakhir tak kitna */
  projectedMonthEndPaise: Paise;
  /** budget se kitna upar jayega (0 = theek hai) */
  projectedOverPaise: Paise;
  /** isi raftaar se paisa kis tareekh ko khatam — null matlab mahina nikal jayega */
  runOutDay: number | null;

  /** aage ke dino me roz kitna kharch karna theek hai */
  safePerDayPaise: Paise;
  status: 'good' | 'tight' | 'over';

  cashPaise: Paise;
  topCategories: CategorySlice[];
  /** pichhle mahine ke muqable sabse zyada badhi category */
  biggestJump: { slice: CategorySlice; diffPaise: Paise } | null;
}

export function buildPlan(input: PlanInput): PlanFacts {
  const now = input.now ?? new Date();
  const reserved = input.reservedBillsPaise ?? 0;

  const { from, to } = monthRange(now);
  const daysInMonth = to.getDate();
  const dayOfMonth = now.getDate();
  const daysLeft = Math.max(1, daysInMonth - dayOfMonth + 1);

  const thisMonth = expensesBetween(input.entries, from, to);
  const spent = sum(thisMonth);

  const prev = previousMonthRange(now);
  const lastMonth = expensesBetween(input.entries, prev.from, prev.to);

  const left = input.monthlyBudgetPaise - spent - reserved;

  // aaj ka din bhi ginte hain, warna mahine ke pehle din divide-by-zero
  const burnPerDay = Math.round(spent / Math.max(1, dayOfMonth));
  const projected = spent + burnPerDay * (daysLeft - 1) + reserved;
  const projectedOver = Math.max(0, projected - input.monthlyBudgetPaise);

  let runOutDay: number | null = null;
  if (burnPerDay > 0 && left > 0) {
    const daysMoneyLasts = Math.floor(left / burnPerDay);
    const day = dayOfMonth + daysMoneyLasts;
    if (day < daysInMonth) runOutDay = day;
  } else if (left <= 0) {
    runOutDay = dayOfMonth;
  }

  const safePerDay = Math.max(0, Math.floor(left / daysLeft / 100) * 100);

  let status: PlanFacts['status'] = 'good';
  if (left <= 0) status = 'over';
  else if (projectedOver > 0) status = 'tight';

  const topCategories = sliceByCategory(thisMonth, lastMonth, spent);

  let biggestJump: PlanFacts['biggestJump'] = null;
  for (const slice of topCategories) {
    const diff = slice.paise - slice.lastMonthPaise;
    if (slice.lastMonthPaise > 0 && diff > (biggestJump?.diffPaise ?? 0)) {
      biggestJump = { slice, diffPaise: diff };
    }
  }

  return {
    budgetPaise: input.monthlyBudgetPaise,
    spentPaise: spent,
    leftPaise: left,
    reservedPaise: reserved,
    dayOfMonth,
    daysInMonth,
    daysLeft,
    burnPerDayPaise: burnPerDay,
    projectedMonthEndPaise: projected,
    projectedOverPaise: projectedOver,
    runOutDay,
    safePerDayPaise: safePerDay,
    status,
    cashPaise: cashBalance(input.entries),
    topCategories,
    biggestJump,
  };
}

/**
 * AI ko bhejne layak chhota, saaf JSON — sirf rupee me, taki model ko
 * paise/rupee ka hisaab hi na karna pade.
 */
export function planFactsForAi(facts: PlanFacts) {
  return {
    budget: r(facts.budgetPaise),
    spent: r(facts.spentPaise),
    left: r(facts.leftPaise),
    dayOfMonth: facts.dayOfMonth,
    daysInMonth: facts.daysInMonth,
    daysLeft: facts.daysLeft,
    perDaySoFar: r(facts.burnPerDayPaise),
    safePerDay: r(facts.safePerDayPaise),
    projectedMonthEnd: r(facts.projectedMonthEndPaise),
    projectedOver: r(facts.projectedOverPaise),
    runOutDay: facts.runOutDay,
    status: facts.status,
    cash: r(facts.cashPaise),
    topCategories: facts.topCategories.slice(0, 4).map((c) => ({
      name: c.label,
      spent: r(c.paise),
      sharePercent: Math.round(c.share * 100),
      lastMonth: r(c.lastMonthPaise),
    })),
  };
}

/* ---------- helpers ---------- */

function r(paise: Paise): number {
  return Math.round(paise / 100);
}

function sum(entries: Entry[]): Paise {
  return entries.reduce((s, e) => s + e.amountPaise, 0);
}

function expensesBetween(entries: Entry[], from: Date, to: Date): Entry[] {
  const f = from.getTime();
  const t = to.getTime();
  return entries.filter((e) => {
    if (e.status !== 'confirmed' || e.type !== 'expense') return false;
    const at = new Date(e.occurredAt).getTime();
    return at >= f && at <= t;
  });
}

function previousMonthRange(now: Date): { from: Date; to: Date } {
  return {
    from: new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0),
    to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
  };
}

function sliceByCategory(thisMonth: Entry[], lastMonth: Entry[], total: Paise): CategorySlice[] {
  const now = new Map<CategoryId, { paise: Paise; count: number }>();
  for (const e of thisMonth) {
    const id = (e.category ?? 'other') as CategoryId;
    const row = now.get(id) ?? { paise: 0, count: 0 };
    row.paise += e.amountPaise;
    row.count += 1;
    now.set(id, row);
  }

  const before = new Map<CategoryId, Paise>();
  for (const e of lastMonth) {
    const id = (e.category ?? 'other') as CategoryId;
    before.set(id, (before.get(id) ?? 0) + e.amountPaise);
  }

  return [...now.entries()]
    .map(([id, row]) => {
      const meta = categoryMeta(id);
      return {
        id,
        label: meta.label,
        emoji: meta.emoji,
        paise: row.paise,
        count: row.count,
        share: total > 0 ? row.paise / total : 0,
        lastMonthPaise: before.get(id) ?? 0,
      };
    })
    .sort((a, b) => b.paise - a.paise);
}
