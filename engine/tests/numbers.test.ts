import { describe, expect, it } from 'vitest';
import { extractAmount, wordsToNumber } from '../src/numbers.js';

describe('wordsToNumber — Hinglish', () => {
  const cases: Array<[string, number]> = [
    ['bees', 20],
    ['saath', 60],
    ['pachas', 50],
    ['ek sau chalis', 140],
    ['do sau', 200],
    ['dhai sau', 250],
    ['sava sau', 125],
    ['sadhe teen sau', 350],
    ['paune do sau', 175],
    ['dedh hazaar', 1500],
    ['do hazaar panch sau', 2500],
    ['pandrah', 15],
    ['ek lakh', 100000],
  ];

  it.each(cases)('%s → %i', (words, expected) => {
    expect(wordsToNumber(words.split(' '))).toBe(expected);
  });

  it('number-word na ho to null deta hai', () => {
    expect(wordsToNumber(['chai', 'peeli'])).toBeNull();
  });
});

describe('extractAmount', () => {
  it('digits nikalta hai', () => {
    expect(extractAmount('chai 20')).toMatchObject({ value: 20, kind: 'digits' });
  });

  it('₹ aur comma sambhalta hai', () => {
    expect(extractAmount('₹1,240 paid to blinkit')?.value).toBe(1240);
  });

  it('500rs jaisa suffix samajhta hai', () => {
    expect(extractAmount('petrol 500rs')?.value).toBe(500);
  });

  it('2k → 2000', () => {
    expect(extractAmount('rent 2k')?.value).toBe(2000);
  });

  it('shabdon wale number bhi', () => {
    expect(extractAmount('sabzi ek sau chalis')).toMatchObject({ value: 140, kind: 'words' });
  });

  it('kai number mile to sabse bada leta hai — "ek chai bees" me 20, 1 nahi', () => {
    expect(extractAmount('ek chai bees')?.value).toBe(20);
  });

  it('amount na ho to null', () => {
    expect(extractAmount('aaj kuch nahi kharch kiya')).toBeNull();
  });

  // golden corpus — ye asli bug tha: "kar do" ka "do" ₹2 ban jata tha
  it.each([
    'add kar do',
    'ye bhi likh do',
    'ek dinner ka paisa add karna hai',
    'char logon ke saath gaya tha',
  ])('aam bol-chaal ko amount nahi banata: "%s"', (line) => {
    expect(extractAmount(line)).toBeNull();
  });

  it('par jodon me wahi shabd chalte hain', () => {
    expect(extractAmount('do sau')?.value).toBe(200);
    expect(extractAmount('char sau pachas')?.value).toBe(450);
  });
});
