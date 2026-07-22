import { describe, expect, it } from 'vitest';
import { planQuery, resolveRange } from '../src/ask.js';
import { answerText, runQuery } from '../src/query.js';
import { toPaise } from '../src/money.js';
import type { Entry } from '../src/types.js';

const NOW = new Date(2026, 6, 22, 21, 0, 0); // 22 July 2026

function entry(over: Partial<Entry>): Entry {
  return {
    id: 'e',
    title: 'Kharcha',
    amountPaise: toPaise(100),
    type: 'expense',
    paidWith: 'digital',
    occurredAt: new Date(2026, 6, 10, 12).toISOString(),
    source: 'notification',
    confidence: 0.9,
    warnings: [],
    status: 'confirmed',
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

describe('planQuery', () => {
  it('merchant + range pakadta hai', () => {
    const plan = planQuery('is mahine swiggy pe kitna gaya?', NOW);
    expect(plan).toMatchObject({
      metric: 'sum',
      filter: { text: 'swiggy', type: 'expense' },
      range: { label: 'this_month' },
      compareToPrevious: true,
    });
  });

  it('kal → yesterday', () => {
    expect(planQuery('kal kitna kharch hua', NOW)?.range.label).toBe('yesterday');
  });

  it('sabse bada kharcha → max', () => {
    expect(planQuery('sabse bada kharcha kya tha', NOW)?.metric).toBe('max');
  });

  it('kitne order → count', () => {
    expect(planQuery('swiggy pe kitne order kiye', NOW)?.metric).toBe('count');
  });

  it('category se bhi filter hota hai', () => {
    expect(planQuery('is hafte khane pe kitna gaya', NOW)?.filter.category).toBe('food');
  });

  it('cash wala sawaal', () => {
    expect(planQuery('cash me kitna kharch hua', NOW)?.filter.paidWith).toBe('cash');
  });

  it('paise se related na ho to null — AI ko bhejne ka case', () => {
    expect(planQuery('mausam kaisa hai', NOW)).toBeNull();
  });
});

describe('resolveRange', () => {
  it('this_month mahine ki 1 tarikh se aaj tak', () => {
    const r = resolveRange('this_month', NOW);
    expect(new Date(r.from).getDate()).toBe(1);
    expect(new Date(r.to).getDate()).toBe(22);
  });

  it('last_month poora pichhla mahina', () => {
    const r = resolveRange('last_month', NOW);
    expect(new Date(r.from).getMonth()).toBe(5); // June
    expect(new Date(r.to).getDate()).toBe(30);
  });
});

describe('runQuery + answerText', () => {
  const entries: Entry[] = [
    entry({ id: '1', title: 'Zomato', merchant: 'Zomato', category: 'food', amountPaise: toPaise(318), occurredAt: new Date(2026, 6, 5, 21).toISOString() }),
    entry({ id: '2', title: 'Zomato', merchant: 'Zomato', category: 'food', amountPaise: toPaise(240), occurredAt: new Date(2026, 6, 12, 22).toISOString() }),
    entry({ id: '3', title: 'Blinkit', merchant: 'Blinkit', category: 'grocery', amountPaise: toPaise(640), occurredAt: new Date(2026, 6, 15, 10).toISOString() }),
    // pichhla mahina
    entry({ id: '4', title: 'Zomato', merchant: 'Zomato', category: 'food', amountPaise: toPaise(300), occurredAt: new Date(2026, 5, 18, 20).toISOString() }),
    // draft/ignored — ginti me nahi aani chahiye
    entry({ id: '5', title: 'Zomato', merchant: 'Zomato', amountPaise: toPaise(999), status: 'ignored' }),
  ];

  it('total sirf confirmed entries ka aata hai', () => {
    const plan = planQuery('is mahine zomato pe kitna gaya', NOW)!;
    const result = runQuery(plan, entries);

    expect(result.valuePaise).toBe(toPaise(558));
    expect(result.count).toBe(2);
  });

  it('pichhle mahine se comparison deta hai', () => {
    const plan = planQuery('is mahine zomato pe kitna gaya', NOW)!;
    const result = runQuery(plan, entries);

    expect(result.previousValuePaise).toBe(toPaise(300));
    expect(answerText(plan, result)).toContain('zyada');
  });

  it('jawab me asli number hota hai', () => {
    const plan = planQuery('is mahine zomato pe kitna gaya', NOW)!;
    const answer = answerText(plan, runQuery(plan, entries));

    expect(answer).toContain('₹558');
    expect(answer).toMatch(/zomato/i);
  });

  it('kuch na mile to saaf bata deta hai', () => {
    const plan = planQuery('is mahine netflix pe kitna gaya', NOW)!;
    expect(answerText(plan, runQuery(plan, entries))).toMatch(/koi kharcha nahi/i);
  });

  it('sabse bada kharcha', () => {
    const plan = planQuery('is mahine sabse bada kharcha', NOW)!;
    const result = runQuery(plan, entries);
    expect(result.valuePaise).toBe(toPaise(640));
    expect(answerText(plan, result)).toContain('Blinkit');
  });

  it('groupBy category', () => {
    const plan = { ...planQuery('is mahine kitna kharch hua', NOW)!, groupBy: 'category' as const };
    const result = runQuery(plan, entries);

    expect(result.breakdown?.[0]).toMatchObject({ key: 'grocery', valuePaise: toPaise(640) });
    expect(result.breakdown).toHaveLength(2);
  });
});
