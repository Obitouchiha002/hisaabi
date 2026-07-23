/**
 * Raat ka summary — app ka sabse zaroori hissa.
 *
 * Har expense app isliye chhoot jati hai kyunki wo kabhi khud nahi bulati.
 * User bhool jata hai, do din ka data adhoora reh jata hai, aur app hat jati hai.
 *
 * Ye line roz raat ko notification me jati hai. Isme teen baatein honi chahiye:
 * aaj kya hua, wo achha tha ya bura, aur kal ka kya plan hai.
 * Number sab yahin bante hain — AI se ek bhi nahi.
 */

import type { Entry, Paise } from './types.js';
import { dayRange, monthRange, safeToSpend, spentBetween } from './budget.js';
import { categoryMeta } from './categories.js';
import { formatINR } from './money.js';

export interface DailySummary {
  todayPaise: Paise;
  yesterdayPaise: Paise;
  /** pichhle 7 din ka rozana average (aaj chhod ke) */
  avgPaise: Paise;
  entryCount: number;
  topCategory: { label: string; emoji: string; paise: Paise } | null;
  safePerDayPaise: Paise;
  monthLeftPaise: Paise;
  status: 'good' | 'tight' | 'over' | 'empty';
  /** notification ka title */
  title: string;
  /** notification ka body */
  body: string;
}

export interface SummaryInput {
  entries: Entry[];
  monthlyBudgetPaise: Paise;
  now?: Date;
  /** "Bhai" / "Vansh" — jaisa user ne chuna */
  name?: string;
}

export function dailySummary(input: SummaryInput): DailySummary {
  const now = input.now ?? new Date();
  const today = dayRange(now);

  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const yestRange = dayRange(yest);

  const todayPaise = spentBetween(input.entries, today.from, today.to);
  const yesterdayPaise = spentBetween(input.entries, yestRange.from, yestRange.to);

  // pichhle 7 din — aaj ko chhod ke, warna aaj khud se hi compare hoga
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const weekPaise = spentBetween(input.entries, dayRange(weekStart).from, yestRange.to);
  const avgPaise = Math.round(weekPaise / 7);

  const month = monthRange(now);
  const budget = safeToSpend({
    monthlyBudgetPaise: input.monthlyBudgetPaise,
    spentThisMonthPaise: spentBetween(input.entries, month.from, month.to),
    now,
  });

  const todayEntries = input.entries.filter((e) => {
    if (e.status !== 'confirmed' || e.type !== 'expense') return false;
    const at = new Date(e.occurredAt).getTime();
    return at >= today.from.getTime() && at <= today.to.getTime();
  });

  const topCategory = pickTopCategory(todayEntries);
  const status: DailySummary['status'] = todayEntries.length === 0 ? 'empty' : budget.status;

  return {
    todayPaise,
    yesterdayPaise,
    avgPaise,
    entryCount: todayEntries.length,
    topCategory,
    safePerDayPaise: budget.perDayPaise,
    monthLeftPaise: Math.max(0, budget.leftPaise),
    status,
    ...buildText({ todayPaise, avgPaise, budget, topCategory, count: todayEntries.length, name: input.name }),
  };
}

function pickTopCategory(entries: Entry[]): DailySummary['topCategory'] {
  if (!entries.length) return null;

  const totals = new Map<string, Paise>();
  for (const e of entries) {
    const id = e.category ?? 'other';
    totals.set(id, (totals.get(id) ?? 0) + e.amountPaise);
  }

  const [id, paise] = [...totals.entries()].sort((a, b) => b[1] - a[1])[0]!;
  const meta = categoryMeta(id as never);
  return { label: meta.label, emoji: meta.emoji, paise };
}

/**
 * Notification ki line.
 *
 * Sirf number dena kaafi nahi — "₹340 kharch" se kuch pata nahi chalta.
 * Uski tulna aur aage ka rasta bhi chahiye, tabhi khol ke dekhne ka mann karta hai.
 */
function buildText(x: {
  todayPaise: Paise;
  avgPaise: Paise;
  budget: ReturnType<typeof safeToSpend>;
  topCategory: DailySummary['topCategory'];
  count: number;
  name?: string;
}): { title: string; body: string } {
  const who = x.name ? `${x.name}, ` : '';

  // Kuch likha hi nahi — taana nahi, bas yaad dila do
  if (x.count === 0) {
    return {
      title: `${who}aaj kuch likha nahi`,
      body: 'Ek baar bol do — "chai bees, auto saath". 10 second ka kaam hai.',
    };
  }

  const title = `Aaj ${formatINR(x.todayPaise)} kharch`;
  const bits: string[] = [];

  if (x.avgPaise > 0) {
    const diff = x.todayPaise - x.avgPaise;
    if (Math.abs(diff) >= 2000) {
      bits.push(`hafte ke average se ${formatINR(Math.abs(diff))} ${diff > 0 ? 'zyada' : 'kam'}`);
    } else {
      bits.push('hafte ke average jaisa hi');
    }
  }

  if (x.topCategory && x.count > 1) {
    bits.push(`sabse zyada ${x.topCategory.emoji} ${x.topCategory.label}`);
  }

  if (x.budget.status === 'over') {
    bits.push('mahine ka budget khatam ho gaya');
  } else if (x.budget.status === 'tight') {
    bits.push(`aage ${formatINR(x.budget.perDayPaise)}/din me chalana hoga`);
  } else {
    bits.push(`kal ${formatINR(x.budget.perDayPaise)} tak theek hai`);
  }

  return { title, body: capitalize(bits.join(' · ')) };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
