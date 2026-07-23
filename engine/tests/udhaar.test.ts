import { describe, expect, it } from 'vitest';
import { parseText } from '../src/parse.js';
import { cashBalance, spentBetween, udhaarSummary, monthRange } from '../src/budget.js';
import { toPaise } from '../src/money.js';
import type { Entry } from '../src/types.js';

const NOW = new Date(2026, 6, 23, 12, 0, 0);

function entry(over: Partial<Entry>): Entry {
  return {
    id: 'e' + Math.random(),
    title: 'x',
    amountPaise: toPaise(100),
    type: 'expense',
    paidWith: 'cash',
    occurredAt: NOW.toISOString(),
    source: 'manual',
    confidence: 0.9,
    warnings: [],
    status: 'confirmed',
    createdAt: '', updatedAt: '',
    ...over,
  };
}

describe('lena-dena parse', () => {
  it.each([
    ['Rahul ko 500 diye', 'lent', 'Rahul'],
    ['Aman se 200 liye', 'borrowed', 'Aman'],
    ['dost se 12 lene hain', 'lent', 'Dost'],
    ['Vikas ko 300 dene hain', 'borrowed', 'Vikas'],
  ])('"%s" → %s', (text, type, party) => {
    const [d] = parseText(text, { now: NOW });
    expect(d?.type).toBe(type);
    expect(d?.counterparty).toBe(party);
  });

  it('title batata hai ki AB karna kya hai', () => {
    // "diye the" ho ya "lene hain" — list me dono ek hi baat kehte hain
    expect(parseText('Rahul ko 500 diye', { now: NOW })[0]?.title).toBe('Rahul se lene hain');
    expect(parseText('Rahul se 500 lene hain', { now: NOW })[0]?.title).toBe('Rahul se lene hain');
  });

  it('normal kharche par asar nahi padta', () => {
    expect(parseText('chai 20', { now: NOW })[0]?.type).toBe('expense');
    expect(parseText('salary mili 25000', { now: NOW })[0]?.type).toBe('income');
    expect(parseText('atm se 2000 nikale', { now: NOW })[0]?.type).toBe('cash_in');
  });
});

describe('udhaar budget me nahi jata', () => {
  it('"Rahul ko 500 diye" mahine ke kharche me nahi ginta', () => {
    const { from, to } = monthRange(NOW);
    const entries = [
      entry({ type: 'expense', amountPaise: toPaise(100) }),
      entry({ type: 'lent', amountPaise: toPaise(500), counterparty: 'Rahul' }),
      entry({ type: 'borrowed', amountPaise: toPaise(200), counterparty: 'Aman' }),
    ];

    // sirf asli kharcha — udhaar wapas aayega, wo kharcha nahi
    expect(spentBetween(entries, from, to)).toBe(toPaise(100));
  });

  it('par jeb ka hisaab (cash) me ginta hai', () => {
    const entries = [
      entry({ type: 'cash_in', amountPaise: toPaise(2000) }),
      entry({ type: 'lent', amountPaise: toPaise(500) }),      // jeb se gaya
      entry({ type: 'borrowed', amountPaise: toPaise(300) }),  // jeb me aaya
    ];
    expect(cashBalance(entries)).toBe(toPaise(1800));
  });
});

describe('udhaarSummary', () => {
  it('kisko kitna dena, kisse kitna lena', () => {
    const s = udhaarSummary([
      entry({ type: 'lent', amountPaise: toPaise(500), counterparty: 'Rahul' }),
      entry({ type: 'lent', amountPaise: toPaise(200), counterparty: 'Sneha' }),
      entry({ type: 'borrowed', amountPaise: toPaise(300), counterparty: 'Aman' }),
    ]);

    expect(s.toGetPaise).toBe(toPaise(700));
    expect(s.toGivePaise).toBe(toPaise(300));
    expect(s.people).toHaveLength(3);
    expect(s.people[0]!.name).toBe('Rahul');     // sabse bada pehle
  });

  it('ek hi bande ka lena-dena jud jata hai', () => {
    const s = udhaarSummary([
      entry({ type: 'lent', amountPaise: toPaise(500), counterparty: 'Rahul' }),
      entry({ type: 'borrowed', amountPaise: toPaise(300), counterparty: 'Rahul' }),
    ]);

    // 500 lene the, 300 dene the → sirf 200 lene baaki
    expect(s.people).toHaveLength(1);
    expect(s.people[0]!.netPaise).toBe(toPaise(200));
    expect(s.toGetPaise).toBe(toPaise(200));
    expect(s.toGivePaise).toBe(0);
  });

  it('hisaab barabar ho to naam list me hi nahi aata', () => {
    const s = udhaarSummary([
      entry({ type: 'lent', amountPaise: toPaise(500), counterparty: 'Rahul' }),
      entry({ type: 'borrowed', amountPaise: toPaise(500), counterparty: 'Rahul' }),
    ]);
    expect(s.people).toEqual([]);
  });

  it('chukta hua udhaar nahi ginta', () => {
    const s = udhaarSummary([
      entry({ type: 'lent', amountPaise: toPaise(500), counterparty: 'Rahul', settledAt: NOW.toISOString() }),
    ]);
    expect(s.toGetPaise).toBe(0);
  });
});
