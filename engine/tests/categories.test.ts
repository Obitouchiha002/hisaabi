import { describe, expect, it } from 'vitest';
import { activeRules, forgetRule, learnCategory, resolveCategory } from '../src/categories.js';
import type { LearnedRule } from '../src/types.js';

const base = { type: 'expense' as const };

describe('resolveCategory', () => {
  it.each([
    ['Chai', 'food'],
    ['Sabzi', 'grocery'],
    ['Auto', 'travel'],
    ['Jio recharge', 'bills'],
    ['Dawa', 'health'],
  ])('title "%s" → %s', (title, expected) => {
    expect(resolveCategory({ ...base, title }).category).toBe(expected);
  });

  it.each([
    ['Blinkit', 'grocery'],
    ['Swiggy', 'food'],
    ['Uber', 'travel'],
    ['Amazon', 'shopping'],
    ['Netflix', 'fun'],
  ])('merchant "%s" → %s', (merchant, expected) => {
    expect(resolveCategory({ ...base, title: merchant, merchant }).category).toBe(expected);
  });

  it('income hamesha income category me jata hai', () => {
    expect(resolveCategory({ title: 'Salary', type: 'income' }).category).toBe('income');
  });

  it('kuch na mile to Anya, aur confidence kam', () => {
    const res = resolveCategory({ ...base, title: 'Xyzabc' });
    expect(res.category).toBe('other');
    expect(res.confidence).toBeLessThan(0.5);
  });
});

describe('auto-learning', () => {
  it('do baar same correction ke baad rule ban jata hai', () => {
    let rules: LearnedRule[] = [];

    rules = learnCategory(rules, 'Blinkit', 'shopping');
    // pehli baar — abhi rule active nahi
    expect(resolveCategory({ ...base, title: 'Blinkit', merchant: 'Blinkit' }, rules).category).toBe('grocery');

    rules = learnCategory(rules, 'Blinkit', 'shopping');
    const res = resolveCategory({ ...base, title: 'Blinkit', merchant: 'Blinkit' }, rules);
    expect(res.category).toBe('shopping');
    expect(res.source).toBe('learned');
  });

  it('user mann badle to count reset hota hai', () => {
    let rules = learnCategory(learnCategory([], 'Blinkit', 'shopping'), 'Blinkit', 'shopping');
    expect(activeRules(rules)).toHaveLength(1);

    rules = learnCategory(rules, 'Blinkit', 'grocery');
    expect(rules[0]).toMatchObject({ category: 'grocery', count: 1 });
    expect(activeRules(rules)).toHaveLength(0);
  });

  it('rule bhulaya ja sakta hai', () => {
    let rules = learnCategory(learnCategory([], 'Blinkit', 'shopping'), 'Blinkit', 'shopping');
    rules = forgetRule(rules, 'Blinkit');
    expect(rules).toHaveLength(0);
  });
});
