import { describe, expect, it } from 'vitest';
import { duplicateScore, findDuplicates, DUPLICATE_THRESHOLD } from '../src/duplicates.js';
import type { DraftEntry, Entry } from '../src/types.js';

function draft(over: Partial<DraftEntry> = {}): DraftEntry {
  return {
    title: 'Blinkit',
    merchant: 'Blinkit',
    amountPaise: 24000,
    type: 'expense',
    paidWith: 'digital',
    occurredAt: '2026-07-22T20:05:00.000Z',
    source: 'notification',
    confidence: 0.9,
    warnings: [],
    ...over,
  };
}

function entry(over: Partial<Entry> = {}): Entry {
  return {
    ...draft({ source: 'voice' }),
    id: 'txn_1',
    status: 'confirmed',
    createdAt: '2026-07-22T20:06:00.000Z',
    updatedAt: '2026-07-22T20:06:00.000Z',
    ...over,
  };
}

describe('duplicateScore', () => {
  it('voice entry + notification = ek hi transaction', () => {
    const { score } = duplicateScore(draft(), entry({ occurredAt: '2026-07-22T20:06:00.000Z' }));
    expect(score).toBeGreaterThanOrEqual(DUPLICATE_THRESHOLD);
  });

  it('amount alag ho to duplicate ho hi nahi sakta', () => {
    expect(duplicateScore(draft({ amountPaise: 25000 }), entry()).score).toBe(0);
  });

  it('type alag ho to duplicate nahi', () => {
    expect(duplicateScore(draft({ type: 'income' }), entry()).score).toBe(0);
  });

  it('same ref = pakka duplicate', () => {
    const { score } = duplicateScore(
      draft({ ref: 'UPI123456', occurredAt: '2026-07-22T18:00:00.000Z' }),
      entry({ ref: 'UPI123456' }),
    );
    expect(score).toBe(1);
  });

  it('same amount par alag dukaan aur 40 min gap → duplicate nahi', () => {
    const { score } = duplicateScore(
      draft({ merchant: 'Zomato', title: 'Zomato', occurredAt: '2026-07-22T20:46:00.000Z' }),
      entry(),
    );
    expect(score).toBeLessThan(DUPLICATE_THRESHOLD);
  });

  it('1 ghante se purani entry check hi nahi hoti', () => {
    expect(duplicateScore(draft({ occurredAt: '2026-07-22T22:00:00.000Z' }), entry()).score).toBe(0);
  });
});

describe('findDuplicates', () => {
  it('ignored/duplicate entries ko nahi ginta', () => {
    const recent = [entry({ id: 'a', status: 'ignored' }), entry({ id: 'b', status: 'duplicate' })];
    expect(findDuplicates(draft(), recent)).toEqual([]);
  });

  it('sabse strong match pehle aata hai', () => {
    const recent = [
      entry({ id: 'far', occurredAt: '2026-07-22T20:25:00.000Z' }),
      entry({ id: 'near', occurredAt: '2026-07-22T20:06:00.000Z' }),
    ];
    const matches = findDuplicates(draft(), recent);
    expect(matches[0]?.entryId).toBe('near');
  });
});
