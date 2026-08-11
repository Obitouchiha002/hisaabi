import { useMemo, useState } from 'react';
import {
  buildMoneyPlan, formatINR, toPaise, toRupees,
  type BucketId, type Loan, type MoneyPlan, type MoneyProfile, type PlanFlag,
} from '@engine';
import { Icon } from '@/components/ui';
import { useStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { loadMoneyProfile, saveMoneyProfile, blankProfile, monthlyBucketSpend } from '@/lib/moneyProfile';

/**
 * Plan — Hisaabi ka naya dil. Money profile → engine → salary ka bantwara +
 * seedhi salah. Har banda ki situation pe alag.
 */

export function Plan() {
  const t = useT();
  const { entries, setRoute } = useStore();
  const [profile, setProfile] = useState<MoneyProfile | null>(() => loadMoneyProfile());
  const [editing, setEditing] = useState(() => loadMoneyProfile() === null);

  const plan = useMemo(() => (profile ? buildMoneyPlan(profile) : null), [profile]);
  const spend = useMemo(() => monthlyBucketSpend(entries), [entries]);

  function save(p: MoneyProfile) {
    saveMoneyProfile(p);
    setProfile(p);
    setEditing(false);
  }

  return (
    <div className="screen">
      <header className="home-top">
        <button className="icon-btn" onClick={() => setRoute('home')} aria-label={t('Back', 'Peeche')}>{Icon.back}</button>
        <div className="grow" style={{ marginLeft: 4 }}>
          <div className="greet">{t('Your money plan', 'Tera paisa plan')}</div>
          <div className="name">{t('Salary, split smartly', 'Salary, samajhdari se baati')}</div>
        </div>
        {profile && !editing && (
          <button className="icon-btn" onClick={() => setEditing(true)} aria-label={t('Edit', 'Badlo')}>{Icon.settings}</button>
        )}
      </header>

      {editing || !profile || !plan
        ? <Setup initial={profile} onSave={save} onCancel={profile ? () => setEditing(false) : undefined} />
        : <PlanView plan={plan} profile={profile} spend={spend} />}
    </div>
  );
}

/* ---------- plan view ---------- */

const BUCKET_LABEL: Record<BucketId, [string, string]> = {
  needs: ['Needs', 'Zaroori'],
  debt: ['Loan', 'Loan'],
  emergency: ['Emergency fund', 'Emergency fund'],
  savings: ['Savings & goal', 'Bachat & goal'],
  fun: ['Fun', 'Masti'],
  buffer: ['Buffer', 'Buffer'],
};
const BUCKET_EMOJI: Record<BucketId, string> = {
  needs: '🏠', debt: '💳', emergency: '🛟', savings: '📈', fun: '🎉', buffer: '🧰',
};

const FLAG_TEXT: Record<PlanFlag, [string, string]> = {
  income_below_needs: ["Your income doesn't cover fixed costs yet. Cut needs or grow income first.", 'Kamai abhi fixed kharche bhi cover nahi karti. Pehle needs ghatao ya income badhao.'],
  high_interest_debt: ['Clear the high-interest loan first — before saving or investing.', 'Pehle mehnga loan khatam karo — bachat/invest baad me.'],
  no_health_insurance: ['No health cover with dependents is a big risk — sort insurance first.', 'Dependents hain aur health cover nahi — bada risk. Pehle insurance.'],
  building_emergency: ['Building your emergency fund first — the goal starts after that.', 'Pehle emergency fund ban raha hai — goal uske baad shuru hoga.'],
  goal_unrealistic: ["This goal won't hit its deadline on this income — extend it or aim lower.", 'Ye goal is salary pe deadline pe nahi milega — deadline badhao ya goal chhota karo.'],
  goal_on_track: ['Your goal is on track. Keep going ✅', 'Goal theek chal raha hai. Aise hi chalte raho ✅'],
  golden: ['Low fixed costs, no debt — a great spot to save & invest aggressively.', 'Kam kharche, koi loan nahi — aggressively bachat aur invest ka mauka.'],
  tight_fun: ['Your fun budget is very tight — the plan is aggressive right now.', 'Fun bahut kam hai — plan abhi aggressive hai.'],
};

function PlanView({ plan, profile, spend }: { plan: MoneyPlan; profile: MoneyProfile; spend: { needs: number; fun: number } }) {
  const t = useT();
  const income = plan.incomePaise;
  const statusTone = plan.status === 'red' ? 'bad' : plan.status === 'tight' ? 'warn' : 'good';

  return (
    <>
      {/* verdict */}
      <div className={`plan-verdict tone-${statusTone}`}>
        <div className="pv-status">
          {plan.status === 'healthy' ? t('On track', 'Sahi raaste pe') : plan.status === 'tight' ? t('A bit tight', 'Thoda tight') : t('Needs attention', 'Dhyan chahiye')}
        </div>
        {plan.flags.map((f) => <p key={f}>{t(FLAG_TEXT[f][0], FLAG_TEXT[f][1])}</p>)}
      </div>

      {/* salary split bar */}
      <div className="split-bar" aria-hidden="true">
        {plan.buckets.map((b) => (
          <i key={b.id} className={`seg-${b.id}`} style={{ width: `${(b.allocatedPaise / Math.max(1, income)) * 100}%` }} />
        ))}
      </div>
      <div className="split-legend">{t(`${formatINR(income)} / month, split:`, `${formatINR(income)} / mahina, aise baата:`)}</div>

      {/* buckets */}
      <div className="bucket-list">
        {plan.buckets.map((b) => {
          const used = b.id === 'needs' ? spend.needs : b.id === 'fun' ? spend.fun : null;
          const overspent = used !== null && used > b.allocatedPaise;
          return (
            <div className="bucket" key={b.id}>
              <span className={`b-dot seg-${b.id}`} />
              <span className="grow">
                <span className="b-name">{BUCKET_EMOJI[b.id]} {t(...BUCKET_LABEL[b.id])}</span>
                {used !== null && (
                  <span className="b-sub" data-tone={overspent ? 'bad' : undefined}>
                    {t(`${formatINR(used)} spent of ${formatINR(b.allocatedPaise)}`, `${formatINR(used)} kharch / ${formatINR(b.allocatedPaise)}`)}
                    {overspent ? t(' · over!', ' · zyada!') : ''}
                  </span>
                )}
              </span>
              <span className="b-amt num">{formatINR(b.allocatedPaise)}</span>
            </div>
          );
        })}
      </div>

      {/* emergency fund */}
      <div className="plan-card">
        <div className="pc-top">
          <span className="pc-k">🛟 {t('Emergency fund', 'Emergency fund')}</span>
          <span className="num">{formatINR(plan.emergencyFundPaise)} / {formatINR(plan.emergencyTargetPaise)}</span>
        </div>
        <div className="bar"><i style={{ width: `${Math.min(100, (plan.emergencyFundPaise / Math.max(1, plan.emergencyTargetPaise)) * 100)}%` }} /></div>
        <p className="pc-note">
          {plan.emergencyFundPaise >= plan.emergencyTargetPaise
            ? t('Fully funded — great safety net.', 'Poora bhar gaya — badhiya safety.')
            : plan.emergencyMonthsToFull
              ? t(`At this rate, full in ~${plan.emergencyMonthsToFull} months.`, `Is rate pe ~${plan.emergencyMonthsToFull} mahine me full.`)
              : t('Add a little each month.', 'Har mahine thoda daalo.')}
        </p>
      </div>

      {/* goal */}
      {profile.goal && plan.goalMonthlyNeededPaise > 0 && (
        <div className="plan-card">
          <div className="pc-top">
            <span className="pc-k">🎯 {profile.goal.name || t('Savings goal', 'Bachat goal')}</span>
            <span className="num">{formatINR(profile.goal.savedPaise)} / {formatINR(profile.goal.targetPaise)}</span>
          </div>
          <div className="bar"><i style={{ width: `${Math.min(100, (profile.goal.savedPaise / Math.max(1, profile.goal.targetPaise)) * 100)}%` }} /></div>
          <p className="pc-note">
            {plan.goalMonthlyPlannedPaise <= 0
              ? t('Starts once your emergency fund / loan is handled.', 'Emergency fund / loan nipatne ke baad shuru hoga.')
              : plan.goalRealisticMonths && plan.goalRealisticMonths > profile.goal.deadlineMonths
                ? t(`Need ${formatINR(plan.goalMonthlyNeededPaise)}/mo but only ${formatINR(plan.goalMonthlyPlannedPaise)} fits — realistically ~${plan.goalRealisticMonths} months.`, `Chahiye ${formatINR(plan.goalMonthlyNeededPaise)}/mahina, par sirf ${formatINR(plan.goalMonthlyPlannedPaise)} fit hota — sach me ~${plan.goalRealisticMonths} mahine.`)
                : t(`Putting ${formatINR(plan.goalMonthlyPlannedPaise)}/month — on track.`, `${formatINR(plan.goalMonthlyPlannedPaise)}/mahina ja raha — on track.`)}
          </p>
        </div>
      )}

      <p className="plan-foot">{t('This is guidance from simple money rules — not licensed financial advice.', 'Ye seedhe paise-niyam se salah hai — koi licensed financial advice nahi.')}</p>
    </>
  );
}

/* ---------- setup form ---------- */

function Setup({ initial, onSave, onCancel }: { initial: MoneyProfile | null; onSave(p: MoneyProfile): void; onCancel?(): void }) {
  const t = useT();
  const start = initial ?? blankProfile();
  const [income, setIncome] = useState(rupeeStr(start.incomePaise));
  const [needs, setNeeds] = useState(rupeeStr(start.fixedNeedsPaise));
  const [loans, setLoans] = useState<Loan[]>(start.loans);
  const [dependents, setDependents] = useState(start.dependents);
  const [stability, setStability] = useState(start.incomeStability);
  const [insurance, setInsurance] = useState(start.hasHealthInsurance);
  const [ef, setEf] = useState(rupeeStr(start.emergencyFundPaise));
  const [hasGoal, setHasGoal] = useState(!!start.goal);
  const [goalName, setGoalName] = useState(start.goal?.name ?? '');
  const [goalTarget, setGoalTarget] = useState(rupeeStr(start.goal?.targetPaise ?? 0));
  const [goalSaved, setGoalSaved] = useState(rupeeStr(start.goal?.savedPaise ?? 0));
  const [goalMonths, setGoalMonths] = useState(String(start.goal?.deadlineMonths || 12));

  function addLoan() { setLoans([...loans, { name: '', emiPaise: 0, kind: 'high_interest' }]); }
  function setLoan(i: number, patch: Partial<Loan>) { setLoans(loans.map((l, j) => (j === i ? { ...l, ...patch } : l))); }

  function submit() {
    onSave({
      incomePaise: toPaise(num(income)),
      fixedNeedsPaise: toPaise(num(needs)),
      loans: loans.filter((l) => l.emiPaise > 0),
      dependents,
      incomeStability: stability,
      hasHealthInsurance: insurance,
      emergencyFundPaise: toPaise(num(ef)),
      goal: hasGoal && num(goalTarget) > 0
        ? { name: goalName.trim() || undefined, targetPaise: toPaise(num(goalTarget)), savedPaise: toPaise(num(goalSaved)), deadlineMonths: Math.max(1, num(goalMonths)) }
        : undefined,
    });
  }

  const valid = num(income) > 0;

  return (
    <div className="plan-setup">
      <p className="setup-lede">{t('Tell me your real situation once — I\'ll build a plan just for you. Everything stays on this phone.', 'Apni asli situation ek baar bata do — main sirf tere liye plan banaunga. Sab kuch is phone me rehta hai.')}</p>

      <Money k={t('Monthly income (take-home)', 'Mahine ki kamai (haath me)')} v={income} set={setIncome} />
      <Money k={t('Fixed monthly needs — rent, bills, ration, commute', 'Fixed mahine ke kharche — rent, bill, ration, aana-jaana')} v={needs} set={setNeeds} />

      <div className="setup-block">
        <div className="sb-head">
          <span className="k">{t('Loans / EMIs', 'Loan / EMI')}</span>
          <button className="btn btn-ghost btn-sm" onClick={addLoan}>+ {t('Add', 'Jodo')}</button>
        </div>
        {loans.length === 0 && <p className="hint-line">{t('No loan? Skip this.', 'Koi loan nahi? Chhod do.')}</p>}
        {loans.map((l, i) => (
          <div className="loan-row" key={i}>
            <input className="text-field" placeholder={t('Name', 'Naam')} value={l.name} onChange={(e) => setLoan(i, { name: e.target.value })} />
            <input className="text-field num" inputMode="numeric" placeholder={t('EMI', 'EMI')} value={l.emiPaise ? String(toRupees(l.emiPaise)) : ''}
                   onChange={(e) => setLoan(i, { emiPaise: toPaise(num(e.target.value)) })} />
            <div className="seg">
              <button data-on={l.kind === 'high_interest'} onClick={() => setLoan(i, { kind: 'high_interest' })}>{t('Costly', 'Mehnga')}</button>
              <button data-on={l.kind === 'low_interest'} onClick={() => setLoan(i, { kind: 'low_interest' })}>{t('Cheap', 'Sasta')}</button>
            </div>
            <button className="loan-x" onClick={() => setLoans(loans.filter((_, j) => j !== i))} aria-label={t('Remove', 'Hatao')}>×</button>
          </div>
        ))}
        <p className="hint-line">{t('Costly = credit card / personal loan. Cheap = home / education loan.', 'Mehnga = card / personal loan. Sasta = home / education loan.')}</p>
      </div>

      <div className="setup-block">
        <span className="k">{t('People depending on you', 'Tumpe nirbhar log')}</span>
        <div className="seg">
          {[0, 1, 2, 3].map((n) => (
            <button key={n} data-on={dependents === n} onClick={() => setDependents(n)}>{n === 3 ? '3+' : n}</button>
          ))}
        </div>
      </div>

      <div className="setup-block">
        <span className="k">{t('Income type', 'Kamai ka type')}</span>
        <div className="seg">
          <button data-on={stability === 'stable'} onClick={() => setStability('stable')}>{t('Salary (steady)', 'Salary (pakki)')}</button>
          <button data-on={stability === 'irregular'} onClick={() => setStability('irregular')}>{t('Irregular', 'Upar-neeche')}</button>
        </div>
      </div>

      <div className="setup-block">
        <span className="k">{t('Health insurance?', 'Health insurance hai?')}</span>
        <div className="seg">
          <button data-on={insurance} onClick={() => setInsurance(true)}>{t('Yes', 'Haan')}</button>
          <button data-on={!insurance} onClick={() => setInsurance(false)}>{t('No', 'Nahi')}</button>
        </div>
      </div>

      <Money k={t('Emergency fund saved so far', 'Emergency fund abhi kitna')} v={ef} set={setEf} />

      <div className="setup-block">
        <div className="sb-head">
          <span className="k">{t('A savings goal?', 'Koi bachat goal?')}</span>
          <button className={`toggle ${hasGoal ? 'on' : ''}`} onClick={() => setHasGoal(!hasGoal)}><i /></button>
        </div>
        {hasGoal && (
          <div className="goal-fields">
            <input className="text-field" placeholder={t('e.g. New phone, trip', 'jaise naya phone, trip')} value={goalName} onChange={(e) => setGoalName(e.target.value)} />
            <div className="field-row">
              <Money k={t('Target', 'Target')} v={goalTarget} set={setGoalTarget} />
              <Money k={t('Already saved', 'Ab tak jama')} v={goalSaved} set={setGoalSaved} />
            </div>
            <label>
              <span className="f-k">{t('In how many months?', 'Kitne mahine me?')}</span>
              <input className="text-field num" inputMode="numeric" value={goalMonths} onChange={(e) => setGoalMonths(e.target.value.replace(/\D/g, ''))} />
            </label>
          </div>
        )}
      </div>

      <div className="q-foot">
        <button className="btn btn-primary btn-block" onClick={submit} disabled={!valid}>{t('Build my plan', 'Mera plan banao')}</button>
        {onCancel && <button className="btn btn-quiet btn-block" onClick={onCancel}>{t('Cancel', 'Rehne do')}</button>}
      </div>
    </div>
  );
}

function Money({ k, v, set }: { k: string; v: string; set(s: string): void }) {
  return (
    <label className="field" style={{ display: 'block' }}>
      <span className="f-k">{k}</span>
      <div className="rupee-in">
        <span>₹</span>
        <input className="text-field num" inputMode="numeric" value={v} onChange={(e) => set(e.target.value.replace(/[^\d]/g, ''))} placeholder="0" />
      </div>
    </label>
  );
}

const rupeeStr = (paise: number) => (paise > 0 ? String(toRupees(paise)) : '');
const num = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0;
