import { describe, expect, it } from 'vitest';
import { calculate, looksLikeMath } from '../src/calc.js';

describe('calculator', () => {
  it.each([
    ['20+30', 50],
    ['3*15', 45],
    ['1200/4', 300],
    ['500-180', 320],
    ['100+50*2', 200],        // guna pehle
    ['(100+50)*2', 300],      // bracket pehle
    ['1200%18', 216],         // 1200 ka 18%
    ['20 + 30 + 15', 65],
    ['₹1,200 - ₹200', 1000],  // rupee aur comma bhi
    ['2 into 15', 30],        // shabd bhi
    ['100 aur 50', 150],
  ])('%s = %i', (input, expected) => {
    expect(calculate(input)?.value).toBe(expected);
  });

  it('dashamlav bhi', () => {
    expect(calculate('10.5*2')?.value).toBe(21);
  });

  it('zero se bhag pe saaf message', () => {
    expect(calculate('100/0')?.error).toMatch(/zero/i);
  });

  it('adhoora bracket pakadta hai', () => {
    expect(calculate('(100+50')?.error).toBeTruthy();
  });

  it('sirf number ganit nahi hai', () => {
    expect(calculate('500')).toBeNull();
    expect(calculate('chai 20')).toBeNull();
  });

  it('kharcha wali line ko ganit nahi samajhta', () => {
    expect(looksLikeMath('chai 20')).toBe(false);
    expect(looksLikeMath('chai bees auto saath')).toBe(false);
    expect(looksLikeMath('is mahine kitna gaya')).toBe(false);
  });

  it('asli ganit pehchanta hai', () => {
    expect(looksLikeMath('20+30')).toBe(true);
    expect(looksLikeMath('3 * 15')).toBe(true);
    expect(looksLikeMath('1200 / 4')).toBe(true);
  });

  it('eval nahi karta — code chalane ki koshish par null', () => {
    expect(calculate('alert(1)')).toBeNull();
    expect(calculate('1;process.exit()')).toBeNull();
  });
});
