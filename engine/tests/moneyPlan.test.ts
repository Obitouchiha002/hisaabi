import { describe, expect, it } from 'vitest';
import { buildMoneyPlan, bucketForCategory, type MoneyProfile } from '../src/moneyPlan.js';

const rs = (n: number) => n * 100;        // rupees → paise
const get = (p: ReturnType<typeof buildMoneyPlan>, id: string) =>
  p.buckets.find((b) => b.id === id)?.allocatedPaise ?? 0;
const sum = (p: ReturnType<typeof buildMoneyPlan>) => p.buckets.reduce((s, b) => s + b.allocatedPaise, 0);

const base: MoneyProfile = {
  incomePaise: rs(30000), fixedNeedsPaise: rs(15000), loans: [],
  dependents: 0, incomeStability: 'stable', hasHealthInsurance: true,
  emergencyFundPaise: 0,
};

describe('money plan — invariants', () => {
  it('buckets sum exactly to income', () => {
    const p = buildMoneyPlan(base);
    expect(sum(p)).toBe(rs(30000));
  });
  it('sab allocations integer paise', () => {
    const p = buildMoneyPlan({ ...base, incomePaise: rs(33333), fixedNeedsPaise: rs(11111) });
    for (const b of p.buckets) expect(Number.isInteger(b.allocatedPaise)).toBe(true);
    expect(sum(p)).toBe(rs(33333));
  });
  it('income needs se kam → red flag, crash nahi', () => {
    const p = buildMoneyPlan({ ...base, incomePaise: rs(8000), fixedNeedsPaise: rs(12000) });
    expect(p.status).toBe('red');
    expect(p.flags).toContain('income_below_needs');
  });
});

describe('money plan — ₹12k low income (needs 8k, goal 30k/12mo, no EF)', () => {
  const p = buildMoneyPlan({
    ...base, incomePaise: rs(12000), fixedNeedsPaise: rs(8000),
    goal: { targetPaise: rs(30000), savedPaise: 0, deadlineMonths: 12 },
  });
  it('needs ~67%', () => expect(p.needsPct).toBeCloseTo(0.67, 1));
  it('pehle emergency fund ban raha, goal wait', () => {
    expect(p.flags).toContain('building_emergency');
    expect(get(p, 'emergency')).toBeGreaterThan(0);
    expect(p.goalMonthlyPlannedPaise).toBe(0);   // EF full nahi, goal 0
  });
  it('goal is salary pe unrealistic', () => expect(p.flags).toContain('goal_unrealistic'));
  it('fun kabhi 0 nahi (zindagi na ruke)', () => expect(get(p, 'fun')).toBeGreaterThan(0));
  it('sum = income', () => expect(sum(p)).toBe(rs(12000)));
});

describe('money plan — ₹25k, do alag log (personalization proof)', () => {
  it('A: single, ghar pe rehta (needs 5k), no loan → golden', () => {
    const p = buildMoneyPlan({
      ...base, incomePaise: rs(25000), fixedNeedsPaise: rs(5000),
      goal: { targetPaise: rs(100000), savedPaise: 0, deadlineMonths: 12 },
    });
    expect(p.flags).toContain('golden');
    expect(p.needsPct).toBeLessThan(0.3);
    expect(get(p, 'fun')).toBeGreaterThan(rs(3000));
  });

  it('B: family, 2 dependents, mehnga loan EMI 8k, rent, no insurance → red, save nahi', () => {
    const p = buildMoneyPlan({
      incomePaise: rs(25000), fixedNeedsPaise: rs(14500),
      loans: [{ name: 'personal', emiPaise: rs(8000), kind: 'high_interest', balancePaise: rs(120000) }],
      dependents: 2, incomeStability: 'stable', hasHealthInsurance: false,
      emergencyFundPaise: 0,
      goal: { targetPaise: rs(100000), savedPaise: 0, deadlineMonths: 12 },
    });
    expect(p.status === 'red' || p.status === 'tight').toBe(true);
    expect(p.flags).toContain('high_interest_debt');
    expect(p.flags).toContain('no_health_insurance');
    expect(p.goalMonthlyPlannedPaise).toBe(0);       // goal/invest abhi nahi
    expect(get(p, 'savings')).toBe(0);
    expect(sum(p)).toBe(rs(25000));
  });
});

describe('money plan — EF full ho to goal chalta hai', () => {
  it('EF already funded → goal ko paisa milta, on track', () => {
    const p = buildMoneyPlan({
      ...base, incomePaise: rs(40000), fixedNeedsPaise: rs(15000),
      emergencyFundPaise: rs(200000),   // pehle se bhara
      goal: { targetPaise: rs(60000), savedPaise: 0, deadlineMonths: 12 },  // 5k/mo chahiye
    });
    expect(p.goalMonthlyPlannedPaise).toBeGreaterThanOrEqual(p.goalMonthlyNeededPaise);
    expect(p.flags).toContain('goal_on_track');
    expect(get(p, 'savings')).toBeGreaterThan(0);
  });
});

describe('money plan — irregular income = bada emergency fund', () => {
  it('freelancer ka EF target salaried se zyada', () => {
    const stable = buildMoneyPlan({ ...base, incomePaise: rs(30000), fixedNeedsPaise: rs(12000), incomeStability: 'stable' });
    const irregular = buildMoneyPlan({ ...base, incomePaise: rs(30000), fixedNeedsPaise: rs(12000), incomeStability: 'irregular' });
    expect(irregular.emergencyTargetPaise).toBeGreaterThan(stable.emergencyTargetPaise);
  });
});

describe('category → bucket', () => {
  it('rent/bills/grocery/travel/health = needs', () => {
    for (const c of ['rent', 'bills', 'grocery', 'travel', 'health', 'education'] as const)
      expect(bucketForCategory(c)).toBe('needs');
  });
  it('food/fun/shopping = fun', () => {
    for (const c of ['food', 'fun', 'shopping'] as const) expect(bucketForCategory(c)).toBe('fun');
  });
});
