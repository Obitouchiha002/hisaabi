import { describe, expect, it } from 'vitest';
import { dailySummary } from '../src/summary.js';
import { toPaise } from '../src/money.js';
import type { Entry } from '../src/types.js';

const NOW = new Date(2026, 6, 23, 21, 0, 0);   // 23 July, raat 9 baje

function entry(daysAgo: number, rupees: number, category = 'food'): Entry {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(13, 0, 0, 0);
  return {
    id: `e${daysAgo}_${rupees}_${Math.random()}`,
    title: 'x',
    amountPaise: toPaise(rupees),
    type: 'expense',
    paidWith: 'cash',
    category: category as never,
    occurredAt: d.toISOString(),
    source: 'manual',
    confidence: 0.9,
    warnings: [],
    status: 'confirmed',
    createdAt: '', updatedAt: '',
  };
}

const budget = toPaise(12000);

describe('raat ka summary', () => {
  it('kuch nahi likha to taana nahi, yaad dilata hai', () => {
    const s = dailySummary({ entries: [], monthlyBudgetPaise: budget, now: NOW, name: 'Bhai' });

    expect(s.status).toBe('empty');
    expect(s.title).toContain('Bhai');
    expect(s.body).toMatch(/bol do/i);
    expect(s.body).not.toMatch(/nahi kiya|kyun/i);   // koi taana nahi
  });

  it('aaj ka total aur hafte se tulna', () => {
    const entries = [
      entry(0, 340),
      ...Array.from({ length: 7 }, (_, i) => entry(i + 1, 200)),
    ];
    const s = dailySummary({ entries, monthlyBudgetPaise: budget, now: NOW });

    expect(s.todayPaise).toBe(toPaise(340));
    expect(s.avgPaise).toBe(toPaise(200));
    expect(s.title).toContain('₹340');
    expect(s.body).toMatch(/₹140 zyada/);
  });

  it('kam kharch hua to bhi batata hai', () => {
    const entries = [entry(0, 50), ...Array.from({ length: 7 }, (_, i) => entry(i + 1, 300))];
    expect(dailySummary({ entries, monthlyBudgetPaise: budget, now: NOW }).body).toMatch(/kam/);
  });

  it('kal kitna kharch kar sakte ho, wo bhi hota hai', () => {
    const s = dailySummary({ entries: [entry(0, 100)], monthlyBudgetPaise: budget, now: NOW });
    expect(s.body).toMatch(/kal ₹[\d,]+ tak theek hai/i);
  });

  it('budget khatam ho to saaf bolta hai', () => {
    const entries = Array.from({ length: 15 }, (_, i) => entry(i, 1000));
    const s = dailySummary({ entries, monthlyBudgetPaise: toPaise(5000), now: NOW });

    expect(s.status).toBe('over');
    expect(s.body).toMatch(/budget khatam/i);
  });

  it('sabse zyada kis pe gaya, wo bhi', () => {
    const entries = [entry(0, 300, 'travel'), entry(0, 50, 'food')];
    const s = dailySummary({ entries, monthlyBudgetPaise: budget, now: NOW });

    expect(s.topCategory?.label).toBe('Aana-jaana');
    expect(s.body).toMatch(/Aana-jaana/);
  });

  it('aaj ka apne aap se comparison nahi hota', () => {
    // sirf aaj ka data — average 0 hona chahiye, aaj ka nahi
    const s = dailySummary({ entries: [entry(0, 500)], monthlyBudgetPaise: budget, now: NOW });
    expect(s.avgPaise).toBe(0);
  });
});
