import { describe, expect, it } from 'vitest';
import { settleUp, splitExpense, tripBalances, tripSummary, type Trip, type TripExpense } from '../src/trips.js';
import { toPaise } from '../src/money.js';

const V = { id: 'v', name: 'Vansh' };
const R = { id: 'r', name: 'Rahul' };
const A = { id: 'a', name: 'Aman' };
const S = { id: 's', name: 'Sneha' };
const K = { id: 'k', name: 'Karan' };

function expense(over: Partial<TripExpense> & { amountPaise: number; paidBy: string }): TripExpense {
  return {
    id: 'e' + Math.random(),
    title: 'Kharcha',
    splitMode: 'equal',
    occurredAt: '2026-07-22T10:00:00.000Z',
    ...over,
  };
}

function trip(members = [V, R, A, S, K], expenses: TripExpense[] = []): Trip {
  return {
    id: 't1', name: 'Goa', emoji: '🏖️',
    members, expenses,
    createdAt: '2026-07-20T00:00:00.000Z',
    status: 'open',
  };
}

describe('splitExpense', () => {
  it('barabar baantta hai', () => {
    const split = splitExpense(expense({ amountPaise: toPaise(500), paidBy: 'v' }), [V, R, A, S, K]);
    expect(Object.values(split)).toEqual([toPaise(100), toPaise(100), toPaise(100), toPaise(100), toPaise(100)]);
  });

  it('bacha hua paisa gayab nahi hota — ₹100 me 3 log', () => {
    const split = splitExpense(expense({ amountPaise: toPaise(100), paidBy: 'v' }), [V, R, A]);
    const total = Object.values(split).reduce((s, v) => s + v, 0);

    expect(total).toBe(toPaise(100));          // ek paisa bhi idhar-udhar nahi
    expect(Object.values(split).sort()).toEqual([3333, 3333, 3334]);
  });

  it('sirf kuch logon me baant sakte hain', () => {
    const split = splitExpense(
      expense({ amountPaise: toPaise(300), paidBy: 'v', splitWith: ['v', 'r'] }),
      [V, R, A],
    );
    expect(split.v).toBe(toPaise(150));
    expect(split.r).toBe(toPaise(150));
    expect(split.a).toBe(0);
  });

  it('hisse ke hisaab se — kamre me do log, do share', () => {
    const split = splitExpense(
      expense({ amountPaise: toPaise(900), paidBy: 'v', splitMode: 'shares', shares: { v: 2, r: 1 } }),
      [V, R],
    );
    expect(split.v).toBe(toPaise(600));
    expect(split.r).toBe(toPaise(300));
  });

  it('exact — jo likha wahi', () => {
    const split = splitExpense(
      expense({
        amountPaise: toPaise(500), paidBy: 'v', splitMode: 'exact',
        exact: { v: toPaise(200), r: toPaise(300) },
      }),
      [V, R],
    );
    expect(split).toEqual({ v: toPaise(200), r: toPaise(300) });
  });
});

describe('tripBalances', () => {
  it('kisne diya aur kiske hisse me kitna aaya', () => {
    const t = trip([V, R], [
      expense({ title: 'Petrol', amountPaise: toPaise(2000), paidBy: 'v' }),
      expense({ title: 'Khana', amountPaise: toPaise(1000), paidBy: 'r' }),
    ]);

    const [vansh, rahul] = tripBalances(t);

    expect(vansh!.paidPaise).toBe(toPaise(2000));
    expect(vansh!.owesPaise).toBe(toPaise(1500));
    expect(vansh!.netPaise).toBe(toPaise(500));   // ₹500 wapas milne hain
    expect(rahul!.netPaise).toBe(toPaise(-500));  // ₹500 dene hain
  });

  it('sab kuch jodo to zero hi bachta hai', () => {
    const t = trip(undefined, [
      expense({ amountPaise: toPaise(1000), paidBy: 'v' }),
      expense({ amountPaise: toPaise(700), paidBy: 'r' }),
      expense({ amountPaise: toPaise(333), paidBy: 'a' }),
    ]);

    const net = tripBalances(t).reduce((s, b) => s + b.netPaise, 0);
    expect(net).toBe(0);
  });
});

describe('settleUp', () => {
  it('kam se kam len-den me hisaab barabar', () => {
    const t = trip([V, R, A], [
      expense({ title: 'Hotel', amountPaise: toPaise(3000), paidBy: 'v' }),
    ]);

    const transfers = settleUp(tripBalances(t));

    // Vansh ne 3000 diye, teeno ka hissa 1000 — do log 1000-1000 denge
    expect(transfers).toHaveLength(2);
    expect(transfers.every((x) => x.to.id === 'v')).toBe(true);
    expect(transfers.reduce((s, x) => s + x.amountPaise, 0)).toBe(toPaise(2000));
  });

  it('5 dost, 4 kharche — phir bhi thode se transfer', () => {
    const t = trip(undefined, [
      expense({ title: 'Petrol', amountPaise: toPaise(2000), paidBy: 'v' }),
      expense({ title: 'Hotel', amountPaise: toPaise(6000), paidBy: 'r' }),
      expense({ title: 'Khana', amountPaise: toPaise(1500), paidBy: 'a' }),
      expense({ title: 'Beach', amountPaise: toPaise(500), paidBy: 'v' }),
    ]);

    const summary = tripSummary(t);

    expect(summary.totalPaise).toBe(toPaise(10000));
    expect(summary.perHeadPaise).toBe(toPaise(2000));
    expect(summary.transfers.length).toBeLessThanOrEqual(4);

    // har transfer ke baad sabka hisaab barabar hona chahiye
    const after = new Map(summary.balances.map((b) => [b.member.id, b.netPaise]));
    for (const t2 of summary.transfers) {
      after.set(t2.from.id, (after.get(t2.from.id) ?? 0) + t2.amountPaise);
      after.set(t2.to.id, (after.get(t2.to.id) ?? 0) - t2.amountPaise);
    }
    for (const value of after.values()) expect(value).toBe(0);
  });

  it('koi kharcha na ho to koi len-den nahi', () => {
    expect(settleUp(tripBalances(trip()))).toEqual([]);
  });

  it('sabne barabar diya to bhi koi len-den nahi', () => {
    const t = trip([V, R], [
      expense({ amountPaise: toPaise(500), paidBy: 'v' }),
      expense({ amountPaise: toPaise(500), paidBy: 'r' }),
    ]);
    expect(settleUp(tripBalances(t))).toEqual([]);
  });
});
