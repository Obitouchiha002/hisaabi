/**
 * Money Plan — Hisaabi ka dimaag.
 *
 * Ye "kitna kharch hua" se aage jaata hai: user ki poori situation dekh kar
 * salary ko buckets me baant deta hai aur seedhi salah deta hai. Har banda
 * alag — loan, family, income ki pakkai, insurance — sab plan badal dete hain.
 * Sabke liye ek hi cheez nahi.
 *
 * Sab kuch integer paise me, aur poori tarah deterministic — koi AI nahi. AI
 * (baad me) sirf in numbers ko lafzon me samjhaega.
 *
 * Faisle 50/30/20 jaise andhे percentage se nahi hote (jo kam income pe tootta
 * hai — India me needs aksar 60-70% ho jate hain). Balki ek **priority-waterfall**:
 *   needs → mehnga loan → emergency fund → goal/invest → fun → buffer.
 */

export type IncomeStability = 'stable' | 'irregular';
export type LoanKind = 'high_interest' | 'low_interest';

export interface Loan {
  name: string;
  emiPaise: number;          // har mahine ki EMI
  kind: LoanKind;            // credit card/personal (mehnga) vs home/education (sasta)
  balancePaise?: number;     // kitna baaki (optional)
}

export interface Goal {
  name?: string;
  targetPaise: number;       // kitna jodna hai
  savedPaise: number;        // ab tak jud gaya
  deadlineMonths: number;    // kitne mahine me
}

/** User ki poori paise-situation. App ise onboarding me bharta hai. */
export interface MoneyProfile {
  incomePaise: number;               // mahine ki net kamai
  fixedNeedsPaise: number;           // rent + ration + bill + commute — jo hone hi hone hai
  loans: Loan[];
  dependents: number;                // kitne log tumpe nirbhar
  incomeStability: IncomeStability;  // salary (stable) ya freelance/dukaan (irregular)
  hasHealthInsurance: boolean;
  emergencyFundPaise: number;        // abhi emergency fund me kitna
  goal?: Goal;
}

export type BucketId = 'needs' | 'debt' | 'emergency' | 'savings' | 'fun' | 'buffer';

export interface Bucket {
  id: BucketId;
  allocatedPaise: number;   // is mahine kitna is bucket me
}

/** Engine kya keh raha hai — app ise apni bhasha me sentence bana leta hai. */
export type PlanFlag =
  | 'income_below_needs'     // kamai fixed kharche bhi cover nahi karti
  | 'high_interest_debt'     // mehnga loan hai — pehle wo
  | 'no_health_insurance'    // cover nahi, dependents pe risk
  | 'building_emergency'     // abhi emergency fund ban raha, goal baad me
  | 'goal_unrealistic'       // is salary pe goal deadline pe nahi milega
  | 'goal_on_track'          // goal theek chal raha
  | 'golden'                 // low needs, no debt — aggressive save/invest ka mauka
  | 'tight_fun';             // fun bahut kam — plan aggressive

export type PlanStatus = 'healthy' | 'tight' | 'red';

export interface MoneyPlan {
  incomePaise: number;
  buckets: Bucket[];                 // sum hamesha = income
  mandatoryNeedsPaise: number;       // needs + saari EMI
  fixedNeedsPaise: number;           // sirf rent/bill/ration (EMI ke bina)
  emiTotalPaise: number;             // saari EMI ka jod
  disposablePaise: number;           // income − mandatory (jo baantne ko bacha)
  funFloorPaise: number;             // fun ka minimum (zindagi na ruke)
  emergencyTargetPaise: number;
  emergencyFundPaise: number;
  emergencyMonthsToFull: number | null;  // is rate pe kitne mahine me full
  goalMonthlyNeededPaise: number;    // goal deadline pe milane ke liye chahiye/mahina
  goalMonthlyPlannedPaise: number;   // plan is mahine goal ko kitna de raha
  goalRealisticMonths: number | null; // is rate pe sach me kitne mahine lagenge
  needsPct: number;                  // (needs+EMI) income ka kitna %  (0-1)
  status: PlanStatus;
  flags: PlanFlag[];
}

/* ---------- config (sensible defaults, baad me user badal sake) ---------- */

const MIN_EMERGENCY_PAISE = 2_500_000;   // ₹25,000 — chhoti shuruaat
const FUN_FLOOR_RATE = 0.08;             // income ka itna to fun ho (zindagi na ruke)
const FUN_SHARE = 0.30;                  // disposable ka itna guilt-free fun
const HIGH_INTEREST_INVEST_BLOCK = true; // mehnga loan ho to invest nahi

/** Emergency fund kitne mahine ka hona chahiye — situation ke hisaab se. */
function emergencyMonths(p: MoneyProfile): number {
  let months = 3;
  if (p.incomeStability === 'irregular') months = 6;       // irregular income = zyada cushion
  else if (p.dependents >= 1) months = 5;                  // family ho to zyada
  if (!p.hasHealthInsurance) months += 1;                  // cover nahi = aur cushion
  return months;
}

/**
 * Poora plan bana do. Pure function — same input, same output.
 */
export function buildMoneyPlan(p: MoneyProfile): MoneyPlan {
  const income = Math.max(0, Math.round(p.incomePaise));
  const flags: PlanFlag[] = [];

  const emiTotal = p.loans.reduce((s, l) => s + Math.max(0, l.emiPaise), 0);
  const highLoans = p.loans.filter((l) => l.kind === 'high_interest');
  const hasHighDebt = highLoans.length > 0;
  const highBalance = highLoans.reduce((s, l) => s + Math.max(0, l.balancePaise ?? 0), 0);

  // Needs = fixed kharche + saari EMI (EMI bhi to deni hi hai)
  const mandatory = Math.round(p.fixedNeedsPaise) + emiTotal;
  const needsPct = income > 0 ? mandatory / income : 1;

  // Emergency fund target: mahine * mandatory, kam se kam ₹25k
  const emTarget = Math.max(MIN_EMERGENCY_PAISE, emergencyMonths(p) * mandatory);
  const emGap = Math.max(0, emTarget - Math.max(0, p.emergencyFundPaise));
  const emFunded = emGap <= 0;

  const goalMonthlyNeeded = p.goal && p.goal.deadlineMonths > 0
    ? Math.ceil(Math.max(0, p.goal.targetPaise - p.goal.savedPaise) / p.goal.deadlineMonths)
    : 0;

  const buckets: Record<BucketId, number> = { needs: mandatory, debt: 0, emergency: 0, savings: 0, fun: 0, buffer: 0 };

  // Kamai needs bhi cover nahi karti — sabse bada red flag
  const disposable = income - mandatory;
  const fixedNeeds = Math.round(p.fixedNeedsPaise);
  if (disposable <= 0) {
    flags.push('income_below_needs');
    if (hasHighDebt) flags.push('high_interest_debt');
    if (!p.hasHealthInsurance) flags.push('no_health_insurance');
    // jo bacha (agar bacha) buffer me
    buckets.buffer = Math.max(0, disposable);
    return finish(income, buckets, {
      mandatory, fixedNeeds, emiTotal, disposable: Math.max(0, disposable), funFloor: 0,
      emTarget, emFund: p.emergencyFundPaise, emRate: 0,
      goalMonthlyNeeded, goalPlanned: 0, needsPct, flags, status: 'red',
    });
  }

  // Fun pehle reserve — taki plan sustainable rahe (zindagi na ruke)
  const funFloor = Math.min(Math.round(income * FUN_FLOOR_RATE), disposable);
  let fun = clamp(Math.round(disposable * FUN_SHARE), funFloor, disposable);
  let savingsPool = disposable - fun;

  // 1. Mehnga loan — sab savings usme, invest/goal rok do
  if (hasHighDebt && savingsPool > 0) {
    const extra = highBalance > 0 ? Math.min(savingsPool, highBalance) : savingsPool;
    buckets.debt += extra;
    savingsPool -= extra;
    flags.push('high_interest_debt');
  }

  // 2. Emergency fund — jab tak full na ho, goal/invest wait
  let goalPlanned = 0;
  if (savingsPool > 0 && !emFunded) {
    const toEm = Math.min(savingsPool, emGap);
    buckets.emergency += toEm;
    savingsPool -= toEm;
    flags.push('building_emergency');
  }

  // 3. Goal / invest — sirf jab EF full ho aur mehnga loan na ho
  const canInvest = emFunded && !(hasHighDebt && HIGH_INTEREST_INVEST_BLOCK);
  if (savingsPool > 0 && canInvest) {
    if (goalMonthlyNeeded > 0) {
      goalPlanned = Math.min(savingsPool, goalMonthlyNeeded);
      buckets.savings += goalPlanned;
      savingsPool -= goalPlanned;
    }
    // jo bacha wo bhi invest/savings me
    if (savingsPool > 0) { buckets.savings += savingsPool; savingsPool = 0; }
  }

  // 4. Jo ab bhi bacha (EF ban raha ho to yahan aata hai) — buffer
  buckets.buffer += savingsPool;
  buckets.fun = fun;

  // emergency ban raha ho aur uske baad bhi paisa bacha to usko bhi EF me daal do
  if (!emFunded && buckets.buffer > 0) {
    const more = Math.min(buckets.buffer, Math.max(0, emGap - buckets.emergency));
    buckets.emergency += more;
    buckets.buffer -= more;
  }

  // ---- flags / status ----
  if (!p.hasHealthInsurance && p.dependents >= 1) flags.push('no_health_insurance');

  const emRate = buckets.emergency;
  const goalRealisticMonths = goalPlanned > 0 && p.goal
    ? Math.ceil(Math.max(0, p.goal.targetPaise - p.goal.savedPaise) / goalPlanned)
    : null;

  if (p.goal && goalMonthlyNeeded > 0) {
    if (goalPlanned >= goalMonthlyNeeded) flags.push('goal_on_track');
    else flags.push('goal_unrealistic');
  }
  if (needsPct <= 0.4 && !hasHighDebt) flags.push('golden');
  if (fun <= funFloor && savingsPoolWasTight(disposable, fun, funFloor)) flags.push('tight_fun');

  let status: PlanStatus = 'healthy';
  if (needsPct > 0.85 || hasHighDebt) status = needsPct > 0.85 ? 'red' : 'tight';
  else if (flags.includes('goal_unrealistic') || flags.includes('tight_fun')) status = 'tight';

  return finish(income, buckets, {
    mandatory, fixedNeeds, emiTotal, disposable, funFloor,
    emTarget, emFund: p.emergencyFundPaise, emRate,
    goalMonthlyNeeded, goalPlanned, needsPct, flags, status, goalRealisticMonths,
  });
}

function finish(
  income: number,
  b: Record<BucketId, number>,
  x: {
    mandatory: number; fixedNeeds: number; emiTotal: number; disposable: number; funFloor: number;
    emTarget: number; emFund: number; emRate: number;
    goalMonthlyNeeded: number; goalPlanned: number; needsPct: number;
    flags: PlanFlag[]; status: PlanStatus; goalRealisticMonths?: number | null;
  },
): MoneyPlan {
  const buckets: Bucket[] = (['needs', 'debt', 'emergency', 'savings', 'fun', 'buffer'] as BucketId[])
    .map((id) => ({ id, allocatedPaise: Math.max(0, Math.round(b[id])) }))
    .filter((bk) => bk.id === 'needs' || bk.id === 'fun' || bk.allocatedPaise > 0);

  const emGap = Math.max(0, x.emTarget - Math.max(0, x.emFund));
  const emergencyMonthsToFull = x.emRate > 0 && emGap > 0 ? Math.ceil(emGap / x.emRate) : (emGap <= 0 ? 0 : null);

  return {
    incomePaise: income,
    buckets,
    mandatoryNeedsPaise: x.mandatory,
    fixedNeedsPaise: x.fixedNeeds,
    emiTotalPaise: x.emiTotal,
    disposablePaise: x.disposable,
    funFloorPaise: x.funFloor,
    emergencyTargetPaise: x.emTarget,
    emergencyFundPaise: Math.max(0, x.emFund),
    emergencyMonthsToFull,
    goalMonthlyNeededPaise: x.goalMonthlyNeeded,
    goalMonthlyPlannedPaise: x.goalPlanned,
    goalRealisticMonths: x.goalRealisticMonths ?? null,
    needsPct: round2(x.needsPct),
    status: x.status,
    flags: dedupe(x.flags),
  };
}

/* ---------- category → bucket ---------- */

import type { CategoryId } from './types.js';

/** Har category kis bucket me aata hai — kharcha plan se milane ke liye. */
export function bucketForCategory(cat: CategoryId): 'needs' | 'fun' | 'other' {
  switch (cat) {
    case 'rent': case 'bills': case 'grocery': case 'travel': case 'health': case 'education':
      return 'needs';
    case 'food': case 'fun': case 'shopping':
      return 'fun';
    default:
      return 'other';
  }
}

/* ---------- chhoti madad ---------- */

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
function round2(n: number): number { return Math.round(n * 100) / 100; }
function dedupe<T>(a: T[]): T[] { return [...new Set(a)]; }
function savingsPoolWasTight(disposable: number, fun: number, funFloor: number): boolean {
  // fun apne floor pe atka aur disposable chhota tha
  return fun <= funFloor && disposable < funFloor * 3;
}
