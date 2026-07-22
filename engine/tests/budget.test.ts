import { describe, expect, it } from 'vitest';
import { cashBalance, dayRange, monthRange, safeToSpend, spentBetween } from '../src/budget.js';
import { formatINR, formatShort, toPaise } from '../src/money.js';
import type { Entry } from '../src/types.js';

function entry(over: Partial<Entry>): Entry {
  return {
    id: 'e',
    title: 'Kharcha',
    amountPaise: 2000,
    type: 'expense',
    paidWith: 'cash',
    occurredAt: '2026-07-12T10:00:00.000Z',
    source: 'manual',
    confidence: 0.9,
    warnings: [],
    status: 'confirmed',
    createdAt: '2026-07-12T10:00:00.000Z',
    updatedAt: '2026-07-12T10:00:00.000Z',
    ...over,
  };
}

describe('safeToSpend', () => {
  it('blueprint wala example — ₹210/din', () => {
    const res = safeToSpend({
      monthlyBudgetPaise: toPaise(12000),
      spentThisMonthPaise: toPaise(7000),
      reservedBillsPaise: toPaise(800),
      now: new Date(2026, 6, 12), // 12 July → 20 din baaki (aaj included)
    });

    expect(res.daysLeft).toBe(20);
    expect(res.leftPaise).toBe(toPaise(4200));
    expect(res.perDayPaise).toBe(toPaise(210));
    expect(formatINR(res.perDayPaise)).toBe('₹210');
  });

  it('budget khatam ho to status over, aur perDay 0 se neeche nahi jata', () => {
    const res = safeToSpend({
      monthlyBudgetPaise: toPaise(5000),
      spentThisMonthPaise: toPaise(6000),
      now: new Date(2026, 6, 20),
    });
    expect(res.status).toBe('over');
    expect(res.perDayPaise).toBe(0);
    expect(res.leftPaise).toBeLessThan(0);
  });

  it('rozana ke hisaab se tang ho to tight', () => {
    const res = safeToSpend({
      monthlyBudgetPaise: toPaise(10000),
      spentThisMonthPaise: toPaise(8000),
      now: new Date(2026, 6, 20), // 12 din chale, 12 din baaki
    });
    expect(res.status).toBe('tight');
  });

  it('mahine ke aakhri din bhi divide by zero nahi hota', () => {
    const res = safeToSpend({
      monthlyBudgetPaise: toPaise(3000),
      spentThisMonthPaise: toPaise(1000),
      now: new Date(2026, 6, 31),
    });
    expect(res.daysLeft).toBe(1);
    expect(res.perDayPaise).toBe(toPaise(2000));
  });
});

describe('cashBalance', () => {
  it('ATM se aaya paisa jodta hai, cash kharche ghatata hai', () => {
    const entries = [
      entry({ id: '1', type: 'cash_in', amountPaise: toPaise(2000) }),
      entry({ id: '2', amountPaise: toPaise(20) }),
      entry({ id: '3', amountPaise: toPaise(60) }),
      entry({ id: '4', amountPaise: toPaise(240), paidWith: 'digital' }), // cash nahi
    ];
    expect(cashBalance(entries)).toBe(toPaise(1920));
  });

  it('unconfirmed entries nahi ginti', () => {
    const entries = [
      entry({ id: '1', type: 'cash_in', amountPaise: toPaise(1000) }),
      entry({ id: '2', amountPaise: toPaise(500), status: 'ignored' }),
    ];
    expect(cashBalance(entries)).toBe(toPaise(1000));
  });
});

describe('spentBetween', () => {
  it('sirf confirmed expense ginta hai — cash_in aur income nahi', () => {
    const { from, to } = monthRange(new Date(2026, 6, 15));
    const entries = [
      entry({ id: '1', amountPaise: toPaise(100) }),
      entry({ id: '2', type: 'cash_in', amountPaise: toPaise(2000) }),
      entry({ id: '3', type: 'income', amountPaise: toPaise(25000) }),
    ];
    expect(spentBetween(entries, from, to)).toBe(toPaise(100));
  });
});

describe('money formatting', () => {
  it('Indian grouping', () => {
    expect(formatINR(toPaise(1234567))).toBe('₹12,34,567');
    expect(formatINR(toPaise(3240))).toBe('₹3,240');
    expect(formatINR(toPaise(20.5))).toBe('₹20.50');
  });

  it('chhota label', () => {
    expect(formatShort(toPaise(3240))).toBe('₹3.2k');
    expect(formatShort(toPaise(240))).toBe('₹240');
  });

  it('din ka range 24 ghante ka hota hai', () => {
    const { from, to } = dayRange(new Date(2026, 6, 22, 15));
    expect(from.getHours()).toBe(0);
    expect(to.getHours()).toBe(23);
  });
});
