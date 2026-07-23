import { describe, expect, it } from 'vitest';
import { parseText } from '../src/parse.js';

const NOW = new Date('2026-07-22T20:00:00+05:30');

describe('parseText', () => {
  it('ek line me kai kharche todta hai', () => {
    const drafts = parseText('chai bees, auto saath, sabzi ek sau chalis', { now: NOW, source: 'voice' });

    expect(drafts).toHaveLength(3);
    expect(drafts.map((d) => [d.title, d.amountPaise])).toEqual([
      ['Chai', 2000],
      ['Auto', 6000],
      ['Sabzi', 14000],
    ]);
    expect(drafts.every((d) => d.type === 'expense')).toBe(true);
  });

  /* Bolte waqt koi comma nahi lagata — ye sabse asli case hai.
     Ek baar ye tootne se poora "ek saath sab bol do" wala vaada tootta hai. */
  describe('bina comma ke bhi todta hai (voice)', () => {
    it('teen kharche, koi comma nahi', () => {
      const drafts = parseText('chai bees auto saath sabzi ek sau chalis', { now: NOW, source: 'voice' });
      expect(drafts.map((d) => [d.title, d.amountPaise])).toEqual([
        ['Chai', 2000],
        ['Auto', 6000],
        ['Sabzi', 14000],
      ]);
    });

    it('digits ke saath bhi', () => {
      const drafts = parseText('chai 20 auto 60 petrol 500', { now: NOW });
      expect(drafts.map((d) => d.amountPaise)).toEqual([2000, 6000, 50000]);
    });

    it('naam amount ke baad ho tab bhi — "bees ki chai"', () => {
      const drafts = parseText('bees ki chai saath ka auto', { now: NOW });
      expect(drafts.map((d) => [d.title, d.amountPaise])).toEqual([
        ['Chai', 2000],
        ['Auto', 6000],
      ]);
    });

    it('ek hi kharcha ho to todta nahi', () => {
      expect(parseText('sabzi ek sau chalis', { now: NOW })).toHaveLength(1);
      expect(parseText('atm se do hazaar nikale', { now: NOW })).toHaveLength(1);
    });

    it('lamba jumla — 5 kharche ek saans me', () => {
      const drafts = parseText(
        'aaj chai bees auto saath sabzi ek sau chalis dopahar khana assi aur raat me zomato teen sau',
        { now: NOW, source: 'voice' },
      );
      expect(drafts.map((d) => d.amountPaise)).toEqual([2000, 6000, 14000, 8000, 30000]);
    });
  });

  it('"aur" pe bhi todta hai', () => {
    const drafts = parseText('chai 20 aur samosa 15', { now: NOW });
    expect(drafts).toHaveLength(2);
    expect(drafts[1]).toMatchObject({ title: 'Samosa', amountPaise: 1500 });
  });

  it('merchant ke saath likha kharcha', () => {
    const [draft] = parseText('petrol 500 HP pump', { now: NOW });
    expect(draft?.amountPaise).toBe(50000);
    expect(draft?.title).toMatch(/Petrol/i);
  });

  it('ATM withdrawal ko kharcha nahi maanta', () => {
    const [draft] = parseText('atm se do hazaar nikale', { now: NOW });
    expect(draft?.type).toBe('cash_in');
    expect(draft?.amountPaise).toBe(200000);
  });

  it('salary ko income maanta hai', () => {
    const [draft] = parseText('salary mili 25000', { now: NOW });
    expect(draft?.type).toBe('income');
    expect(draft?.amountPaise).toBe(2500000);
  });

  it('UPI likha ho to digital maanta hai', () => {
    const [draft] = parseText('blinkit 240 upi se', { now: NOW });
    expect(draft?.paidWith).toBe('digital');
  });

  it('default cash hai (voice/manual entries aksar cash hote hain)', () => {
    const [draft] = parseText('chai 20', { now: NOW });
    expect(draft?.paidWith).toBe('cash');
  });

  it('digits wale amount pe confidence zyada hoti hai', () => {
    const [digits] = parseText('chai 20', { now: NOW });
    const [words] = parseText('chai bees', { now: NOW });
    expect(digits!.confidence).toBeGreaterThan(words!.confidence);
    expect(words!.warnings).toContain('amount_uncertain');
  });

  it('title na mile to warning deta hai', () => {
    const [draft] = parseText('200', { now: NOW });
    expect(draft?.warnings).toContain('title_missing');
    expect(draft?.confidence).toBeLessThan(0.8);
  });

  it('amount na ho to kuch nahi banata', () => {
    expect(parseText('aaj kuch nahi kiya', { now: NOW })).toEqual([]);
    expect(parseText('', { now: NOW })).toEqual([]);
  });

  it('₹1 se kam ko ignore karta hai', () => {
    expect(parseText('chai 0.5', { now: NOW })).toEqual([]);
  });
});
