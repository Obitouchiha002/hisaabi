import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildMoneyPlan, formatINR, formatShort, toPaise, toRupees,
  type BucketId, type Loan, type MoneyPlan, type MoneyProfile,
} from '@engine';
import { Icon } from '@/components/ui';
import { useStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { loadMoneyProfile, saveMoneyProfile, monthlyBucketSpend, planPulse } from '@/lib/moneyProfile';

/**
 * Plan — Hisaabi ka dil. Ek chat-coach jaisa: coach personal sawal puchhta hai
 * (bas tap ya slider, kuch type nahi), phir "tumhari condition dekh ke" plan
 * banata hai. Har banda alag — plan uski situation pe, fixed rules pe nahi.
 */
export function Plan() {
  const t = useT();
  const { entries, setRoute } = useStore();
  const [profile, setProfile] = useState<MoneyProfile | null>(() => loadMoneyProfile());
  const [editing, setEditing] = useState(() => loadMoneyProfile() === null);

  const plan = useMemo(() => (profile ? buildMoneyPlan(profile) : null), [profile]);
  const spend = useMemo(() => monthlyBucketSpend(entries), [entries]);
  const pulse = useMemo(() => (plan ? planPulse(plan, entries) : null), [plan, entries]);

  function save(p: MoneyProfile) {
    saveMoneyProfile(p);
    setProfile(p);
    setEditing(false);
  }

  return (
    <div className="screen plan-screen">
      <header className="home-top">
        <button className="icon-btn" onClick={() => setRoute('home')} aria-label={t('Back', 'Peeche')}>{Icon.back}</button>
        <div className="grow" style={{ marginLeft: 4 }}>
          <div className="greet">{t('Your money coach', 'Tera paisa coach')}</div>
          <div className="name">{t('A plan made for you', 'Sirf tere liye plan')}</div>
        </div>
        {profile && !editing && (
          <button className="icon-btn" onClick={() => setEditing(true)} aria-label={t('Redo', 'Dobara')}>{Icon.settings}</button>
        )}
      </header>

      {editing || !profile || !plan
        ? <CoachChat initial={profile} onDone={save} onCancel={profile ? () => setEditing(false) : undefined} />
        : <CoachView plan={plan} profile={profile} spend={spend} pulse={pulse} />}
    </div>
  );
}

/* ============================================================
   CHAT COACH ONBOARDING — sirf tap + slider, koi typing nahi
   ============================================================ */

type StepId =
  | 'intro' | 'income' | 'needsMode' | 'needs' | 'needsItems' | 'loanHas' | 'loanKind' | 'loanEmi'
  | 'dependents' | 'stability' | 'insurance' | 'ef'
  | 'goalHas' | 'goalPreset' | 'goalTarget' | 'goalMonths';

interface Answers {
  income: number;        // rupees
  needsMode: 'total' | 'items';
  needs: number;         // final fixed-needs total (rupees)
  loanHas: 'yes' | 'no';
  loanKind: 'high_interest' | 'low_interest';
  loanEmi: number;
  dependents: number;
  stability: 'stable' | 'irregular';
  insurance: 'yes' | 'no';
  ef: number;
  goalHas: 'yes' | 'no';
  goalPreset: string;    // emoji+label key
  goalTarget: number;
  goalMonths: number;
}

const GOAL_PRESETS: { key: string; emoji: string; label: [string, string] }[] = [
  { key: 'phone', emoji: '📱', label: ['New phone', 'Naya phone'] },
  { key: 'trip', emoji: '✈️', label: ['A trip', 'Ek trip'] },
  { key: 'bike', emoji: '🏍️', label: ['Bike / vehicle', 'Bike / gaadi'] },
  { key: 'other', emoji: '🎯', label: ['Something else', 'Aur kuch'] },
];

function defaultAnswers(p: MoneyProfile | null): Answers {
  return {
    income: p ? toRupees(p.incomePaise) : 20000,
    needsMode: 'total',
    needs: p ? toRupees(p.fixedNeedsPaise) : 10000,
    loanHas: p && p.loans.length ? 'yes' : 'no',
    loanKind: p?.loans[0]?.kind ?? 'high_interest',
    loanEmi: p?.loans[0] ? toRupees(p.loans[0].emiPaise) : 3000,
    dependents: p?.dependents ?? 0,
    stability: p?.incomeStability ?? 'stable',
    insurance: p?.hasHealthInsurance ? 'yes' : 'no',
    ef: p ? toRupees(p.emergencyFundPaise) : 0,
    goalHas: p?.goal ? 'yes' : 'no',
    goalPreset: 'other',
    goalTarget: p?.goal ? toRupees(p.goal.targetPaise) : 20000,
    goalMonths: p?.goal?.deadlineMonths ?? 12,
  };
}

function activeSteps(a: Answers): StepId[] {
  const s: StepId[] = ['intro', 'income', 'needsMode'];
  s.push(a.needsMode === 'items' ? 'needsItems' : 'needs');
  s.push('loanHas');
  if (a.loanHas === 'yes') s.push('loanKind', 'loanEmi');
  s.push('dependents', 'stability', 'insurance', 'ef', 'goalHas');
  if (a.goalHas === 'yes') s.push('goalPreset', 'goalTarget', 'goalMonths');
  return s;
}

function CoachChat({ initial, onDone, onCancel }: { initial: MoneyProfile | null; onDone(p: MoneyProfile): void; onCancel?(): void }) {
  const t = useT();
  const [ans, setAns] = useState<Answers>(() => defaultAnswers(initial));
  const [idx, setIdx] = useState(0);
  const [ready, setReady] = useState(false);   // coach type kar chuka? tabhi options aaye
  const [planning, setPlanning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const steps = activeSteps(ans);
  const done = idx >= steps.length;

  // naya sawal → pehle coach type karega, phir options
  useEffect(() => { setReady(false); }, [idx]);

  // naya sawal / typing / options aane pe neeche scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [idx, planning, ready]);

  // sab jawab ho gaye → planning animation → plan
  useEffect(() => {
    if (!done) return;
    setPlanning(true);
    const id = setTimeout(() => onDone(toProfile(ans)), 2400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  function answer<K extends keyof Answers>(key: K, val: Answers[K]) {
    setAns((a) => ({ ...a, [key]: val }));
    setIdx((i) => i + 1);
  }
  function advance() { setIdx((i) => i + 1); }

  const current = steps[idx];

  return (
    <div className="coach">
      <div className="coach-scroll" ref={scrollRef}>
        {/* answered transcript */}
        {steps.slice(0, idx).map((s) => (
          <div className="coach-turn" key={s}>
            <Bubble who="coach">{ask(s, ans, t)}</Bubble>
            {answerLabel(s, ans, t) && <Bubble who="me">{answerLabel(s, ans, t)}</Bubble>}
          </div>
        ))}

        {/* current question — typewriter */}
        {!done && (
          <div className="coach-turn" key={`cur-${current}`}>
            <Bubble who="coach" fresh><Typewriter text={ask(current, ans, t)} onDone={() => setReady(true)} /></Bubble>
          </div>
        )}

        {/* planning animation */}
        {planning && <Planning />}
      </div>

      {/* active control — coach ke type karne ke baad */}
      {!done && ready && (
        <div className="coach-input" key={`ctl-${current}`}>
          <Control step={current} ans={ans} answer={answer} advance={advance} onCancel={idx === 0 ? onCancel : undefined} />
        </div>
      )}
    </div>
  );
}

function Bubble({ who, fresh, children }: { who: 'coach' | 'me'; fresh?: boolean; children: React.ReactNode }) {
  return <div className={`bubble b-${who} ${fresh ? 'b-fresh' : ''}`}>{who === 'coach' && <span className="b-face">🦉</span>}<span className="b-text">{children}</span></div>;
}

function Planning() {
  const t = useT();
  const lines = [
    t('Reading your income…', 'Tumhari kamai dekh raha hu…'),
    t('Understanding your fixed costs…', 'Zaroori kharche samajh raha hu…'),
    t('Sizing your safety net…', 'Emergency fund set kar raha hu…'),
    t('Shaping a plan for you…', 'Tumhare hisaab se plan bana raha hu…'),
  ];
  const [n, setN] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setN((x) => Math.min(lines.length, x + 1)), 550);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="coach-turn">
      <div className="planning">
        <div className="plan-orbit"><i /><i /><i /></div>
        {lines.slice(0, n).map((l, i) => <p key={i} style={{ animationDelay: `${i * 60}ms` }}>{l}</p>)}
      </div>
    </div>
  );
}

/* ---------- questions ---------- */

function ask(s: StepId, a: Answers, t: (e: string, h: string) => string): string {
  switch (s) {
    case 'intro': return t("Hi! I'm your money coach 👋 A few quick taps — no typing — and I'll build a plan just for you.", 'Hi! Main tera paisa-coach 👋 Bas kuch tap — kuch type nahi karna — aur main sirf tere liye plan bana dunga.');
    case 'income': return t('First — how much comes in every month, in hand?', 'Sabse pehle — mahine me haath me kitna aata hai?');
    case 'needsMode': return t('Your fixed monthly costs — tell me one total, or break it down?', 'Mahine ke pakke kharche — ek total bata do, ya ek-ek karke?');
    case 'needs': return t('Roughly how much is fixed every month? Rent, bills, ration, travel.', 'Lagbhag pakka kitna nikal jaata hai? Rent, bill, ration, aana-jaana.');
    case 'needsItems': return t('Set each one — I\'ll add them up for you.', 'Ek-ek set karo — main khud jod dunga.');
    case 'loanHas': return t('Any loan or EMI running?', 'Koi loan ya EMI chalti hai?');
    case 'loanKind': return t('What kind of loan?', 'Kaisa loan hai?');
    case 'loanEmi': return t('How much is the EMI each month?', 'Har mahine EMI kitni jaati hai?');
    case 'dependents': return t('How many people depend on you?', 'Tumpe kitne log depend karte hain?');
    case 'stability': return t('Is your income steady or up-and-down?', 'Kamai pakki hai ya upar-neeche?');
    case 'insurance': return t('Do you have health insurance?', 'Health insurance hai?');
    case 'ef': return t('Anything saved for emergencies already?', 'Emergency ke liye abhi kuch jama hai?');
    case 'goalHas': return t('Any dream you want to save for?', 'Koi sapna jiske liye bachat karni hai?');
    case 'goalPreset': return t('Nice — what is it for?', 'Badhiya — kiske liye?');
    case 'goalTarget': return t('Roughly how much will it cost?', 'Lagbhag kitne ka hai?');
    case 'goalMonths': return t('By when do you want it?', 'Kab tak chahiye?');
  }
}

function answerLabel(s: StepId, a: Answers, t: (e: string, h: string) => string): string | null {
  switch (s) {
    case 'intro': return null;
    case 'income': return formatINR(toPaise(a.income));
    case 'needsMode': return a.needsMode === 'items' ? t('Break it down', 'Ek-ek karke') : t('One total', 'Ek total');
    case 'needs': return formatINR(toPaise(a.needs));
    case 'needsItems': return formatINR(toPaise(a.needs));
    case 'loanHas': return a.loanHas === 'yes' ? t('Yes', 'Haan') : t('No loan', 'Koi nahi');
    case 'loanKind': return a.loanKind === 'high_interest' ? t('Costly (card/personal)', 'Mehnga (card/personal)') : t('Cheap (home/education)', 'Sasta (home/education)');
    case 'loanEmi': return formatINR(toPaise(a.loanEmi)) + '/mo';
    case 'dependents': return a.dependents === 3 ? '3+' : String(a.dependents);
    case 'stability': return a.stability === 'stable' ? t('Steady', 'Pakki') : t('Up-and-down', 'Upar-neeche');
    case 'insurance': return a.insurance === 'yes' ? t('Yes', 'Haan') : t('No', 'Nahi');
    case 'ef': return a.ef > 0 ? formatINR(toPaise(a.ef)) : t('Nothing yet', 'Abhi kuch nahi');
    case 'goalHas': return a.goalHas === 'yes' ? t('Yes', 'Haan') : t('Not now', 'Abhi nahi');
    case 'goalPreset': { const g = GOAL_PRESETS.find((x) => x.key === a.goalPreset); return g ? `${g.emoji} ${t(...g.label)}` : null; }
    case 'goalTarget': return formatINR(toPaise(a.goalTarget));
    case 'goalMonths': return monthsLabel(a.goalMonths, t);
  }
}

function monthsLabel(m: number, t: (e: string, h: string) => string): string {
  if (m <= 6) return t('6 months', '6 mahine');
  if (m <= 12) return t('1 year', '1 saal');
  if (m <= 24) return t('2 years', '2 saal');
  return t('3 years', '3 saal');
}

/* ---------- controls (tap / slider) ---------- */

function Control({ step, ans, answer, advance, onCancel }: {
  step: StepId; ans: Answers;
  answer<K extends keyof Answers>(k: K, v: Answers[K]): void;
  advance(): void; onCancel?(): void;
}) {
  const t = useT();

  switch (step) {
    case 'intro':
      return (
        <div className="ctl-row">
          {onCancel && <button className="btn btn-quiet" onClick={onCancel}>{t('Cancel', 'Rehne do')}</button>}
          <button className="btn btn-primary btn-block" onClick={advance}>{t("Let's go →", 'Chalo shuru →')}</button>
        </div>
      );

    case 'income':
      return <SliderCtl value={ans.income} min={0} max={200000} step={1000} onNext={(v) => answer('income', v)} okLabel={t('Next →', 'Aage →')} disabled={(v) => v <= 0} />;
    case 'needsMode':
      return <Chips options={[[t('💯 Just a total', '💯 Ek total'), 'total'], [t('🧾 Break it down', '🧾 Ek-ek karke'), 'items']]} onPick={(v) => answer('needsMode', v as 'total' | 'items')} />;
    case 'needs':
      return <SliderCtl value={ans.needs} min={0} max={Math.max(2000, ans.income)} step={500} onNext={(v) => answer('needs', v)} okLabel={t('Next →', 'Aage →')} />;
    case 'needsItems':
      return <ItemizedNeeds max={Math.max(2000, ans.income)} onNext={(total) => answer('needs', total)} okLabel={t('Next →', 'Aage →')} />;
    case 'loanEmi':
      return <SliderCtl value={ans.loanEmi} min={0} max={50000} step={500} onNext={(v) => answer('loanEmi', v)} okLabel={t('Next →', 'Aage →')} />;
    case 'ef':
      return <SliderCtl value={ans.ef} min={0} max={200000} step={1000} onNext={(v) => answer('ef', v)} okLabel={t('Next →', 'Aage →')} />;
    case 'goalTarget':
      return <SliderCtl value={ans.goalTarget} min={1000} max={500000} step={1000} onNext={(v) => answer('goalTarget', v)} okLabel={t('Next →', 'Aage →')} />;

    case 'loanHas':
      return <Chips options={[[t('No loan', 'Koi loan nahi'), 'no'], [t('Yes, I have one', 'Haan, hai'), 'yes']]} onPick={(v) => answer('loanHas', v as 'yes' | 'no')} />;
    case 'loanKind':
      return <Chips options={[[t('💳 Card / personal', '💳 Card / personal'), 'high_interest'], [t('🏠 Home / education', '🏠 Home / education'), 'low_interest']]} onPick={(v) => answer('loanKind', v as 'high_interest' | 'low_interest')} />;
    case 'dependents':
      return <Chips wrap options={[['0', '0'], ['1', '1'], ['2', '2'], ['3+', '3']]} onPick={(v) => answer('dependents', Number(v))} />;
    case 'stability':
      return <Chips options={[[t('💼 Steady salary', '💼 Pakki salary'), 'stable'], [t('🔀 Up-and-down', '🔀 Upar-neeche'), 'irregular']]} onPick={(v) => answer('stability', v as 'stable' | 'irregular')} />;
    case 'insurance':
      return <Chips options={[[t('✅ Yes', '✅ Haan'), 'yes'], [t('❌ No', '❌ Nahi'), 'no']]} onPick={(v) => answer('insurance', v as 'yes' | 'no')} />;
    case 'goalHas':
      return <Chips options={[[t('Not now', 'Abhi nahi'), 'no'], [t('Yes, a dream ✨', 'Haan, ek sapna ✨'), 'yes']]} onPick={(v) => answer('goalHas', v as 'yes' | 'no')} />;
    case 'goalPreset':
      return <Chips wrap options={GOAL_PRESETS.map((g) => [`${g.emoji} ${t(...g.label)}`, g.key] as [string, string])} onPick={(v) => answer('goalPreset', v)} />;
    case 'goalMonths':
      return <Chips wrap options={[[t('6 months', '6 mahine'), '6'], [t('1 year', '1 saal'), '12'], [t('2 years', '2 saal'), '24'], [t('3 years', '3 saal'), '36']]} onPick={(v) => answer('goalMonths', Number(v))} />;
  }
}

function Chips({ options, onPick, wrap }: { options: [string, string][]; onPick(v: string): void; wrap?: boolean }) {
  return (
    <div className={`chips ${wrap ? 'chips-wrap' : ''}`}>
      {options.map(([label, val]) => (
        <button key={val} className="chip" onClick={() => onPick(val)}>{label}</button>
      ))}
    </div>
  );
}

function SliderCtl({ value, min, max, step, onNext, okLabel, disabled }: {
  value: number; min: number; max: number; step: number;
  onNext(v: number): void; okLabel: string; disabled?(v: number): boolean;
}) {
  const [v, setV] = useState(value);
  const blocked = disabled ? disabled(v) : false;
  const pct = ((v - min) / Math.max(1, max - min)) * 100;
  return (
    <div className="slider-ctl">
      <label className="slider-val"><span className="sv-cur">₹</span>
        <input className="sv-input num" inputMode="numeric" placeholder="0"
               value={v ? v.toLocaleString('en-IN') : ''}
               onChange={(e) => setV(Math.min(max, Number(e.target.value.replace(/[^\d]/g, '')) || 0))} />
      </label>
      <div className="slider-wrap">
        <button className="step-b" onClick={() => setV(Math.max(min, v - step))} aria-label="−">−</button>
        <input
          className="slider" type="range" min={min} max={max} step={step} value={v}
          style={{ ['--pct' as string]: `${pct}%` }}
          onChange={(e) => setV(Number(e.target.value))}
        />
        <button className="step-b" onClick={() => setV(Math.min(max, v + step))} aria-label="+">+</button>
      </div>
      <button className="btn btn-primary btn-block" disabled={blocked} onClick={() => onNext(v)}>{okLabel}</button>
    </div>
  );
}

function ItemizedNeeds({ max, onNext, okLabel }: { max: number; onNext(total: number): void; okLabel: string }) {
  const t = useT();
  const rows: { key: string; emoji: string; label: [string, string]; init: number }[] = [
    { key: 'rent', emoji: '🏠', label: ['Rent / home', 'Ghar / rent'], init: 5000 },
    { key: 'bills', emoji: '📱', label: ['Bills / recharge', 'Bill / recharge'], init: 1000 },
    { key: 'ration', emoji: '🛒', label: ['Ration / grocery', 'Ration / grocery'], init: 3000 },
    { key: 'travel', emoji: '🚌', label: ['Travel', 'Aana-jaana'], init: 1000 },
    { key: 'other', emoji: '➕', label: ['Other', 'Aur kuch'], init: 0 },
  ];
  const [vals, setVals] = useState<number[]>(rows.map((r) => Math.min(r.init, max)));
  const total = vals.reduce((s, v) => s + v, 0);
  const rowMax = Math.max(2000, max);
  return (
    <div className="items-ctl">
      <div className="items-total"><span className="it-k">{t('Total fixed', 'Kul pakka')}</span><span className="num">{formatINR(toPaise(total))}</span></div>
      <div className="items-rows">
        {rows.map((r, i) => (
          <div className="item-row" key={r.key}>
            <div className="ir-top">
              <span className="ir-label">{r.emoji} {t(...r.label)}</span>
              <label className="ir-val"><span className="sv-cur sm">₹</span>
                <input className="ir-input num" inputMode="numeric" placeholder="0"
                       value={vals[i] ? vals[i].toLocaleString('en-IN') : ''}
                       onChange={(e) => { const n = Math.min(rowMax, Number(e.target.value.replace(/[^\d]/g, '')) || 0); setVals((vs) => vs.map((v, j) => (j === i ? n : v))); }} />
              </label>
            </div>
            <input
              className="slider slim" type="range" min={0} max={rowMax} step={500} value={vals[i]}
              style={{ ['--pct' as string]: `${(vals[i] / rowMax) * 100}%` }}
              onChange={(e) => setVals((vs) => vs.map((v, j) => (j === i ? Number(e.target.value) : v)))}
            />
          </div>
        ))}
      </div>
      <button className="btn btn-primary btn-block" onClick={() => onNext(total)}>{okLabel}</button>
    </div>
  );
}

/** Coach ka text ek-ek akshar type hoke aata hai. */
function Typewriter({ text, onDone }: { text: string; onDone?(): void }) {
  const [n, setN] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    setN(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) { clearInterval(id); doneRef.current?.(); }
    }, 16);
    return () => clearInterval(id);
  }, [text]);
  return <>{text.slice(0, n)}{n < text.length && <span className="tw-caret" />}</>;
}

function toProfile(a: Answers): MoneyProfile {
  const preset = GOAL_PRESETS.find((g) => g.key === a.goalPreset);
  const loans: Loan[] = a.loanHas === 'yes' && a.loanEmi > 0
    ? [{ name: 'Loan', emiPaise: toPaise(a.loanEmi), kind: a.loanKind }]
    : [];
  return {
    incomePaise: toPaise(a.income),
    fixedNeedsPaise: toPaise(a.needs),
    loans,
    dependents: a.dependents,
    incomeStability: a.stability,
    hasHealthInsurance: a.insurance === 'yes',
    emergencyFundPaise: toPaise(a.ef),
    goal: a.goalHas === 'yes' && a.goalTarget > 0
      ? { name: preset ? preset.label[0] : undefined, targetPaise: toPaise(a.goalTarget), savedPaise: 0, deadlineMonths: a.goalMonths }
      : undefined,
  };
}

/* ============================================================
   COACH PLAN VIEW — samjha-samjha ke, tumhari condition pe
   ============================================================ */

const BUCKET_LABEL: Record<BucketId, [string, string]> = {
  needs: ['Needs', 'Zaroori'],
  debt: ['Loan payoff', 'Loan chukana'],
  emergency: ['Emergency fund', 'Emergency fund'],
  savings: ['Invest / goal', 'Invest / goal'],
  fun: ['Fun', 'Masti'],
  buffer: ['Buffer', 'Buffer'],
};
const BUCKET_EMOJI: Record<BucketId, string> = { needs: '🏠', debt: '💳', emergency: '🛟', savings: '📈', fun: '🎉', buffer: '🧰' };

function CoachView({ plan, profile, spend, pulse }: {
  plan: MoneyPlan; profile: MoneyProfile;
  spend: { needs: number; fun: number };
  pulse: ReturnType<typeof planPulse> | null;
}) {
  const t = useT();
  const income = plan.incomePaise;
  const statusTone = plan.status === 'red' ? 'bad' : plan.status === 'tight' ? 'warn' : 'good';

  // invest bucket locked? (EF ban raha ya mehnga loan) — dikhao taaki user samjhe
  const hasSavings = plan.buckets.some((b) => b.id === 'savings');
  const investLocked = !hasSavings && (plan.flags.includes('building_emergency') || plan.flags.includes('high_interest_debt'));

  // overspend shift (fun)
  const funAlloc = plan.buckets.find((b) => b.id === 'fun')?.allocatedPaise ?? 0;
  const overFun = Math.max(0, spend.fun - funAlloc);
  const nextMonthFun = Math.max(plan.funFloorPaise, funAlloc - overFun);

  return (
    <div className="coachview">
      {/* coach reads your situation */}
      <div className={`cv-intro tone-${statusTone}`}>
        <span className="cv-face">🦉</span>
        <p>{readSituation(plan, t)}</p>
      </div>

      {/* salary graph — donut */}
      <div className="salary-graph">
        <Donut buckets={plan.buckets} income={income} />
        <div className="sg-legend">
          {plan.buckets.map((b) => (
            <span className="sgl" key={b.id}>
              <i className={`sgl-dot seg-${b.id}`} />
              <span className="sgl-name">{t(...BUCKET_LABEL[b.id])}</span>
              <b className="num">{Math.round((b.allocatedPaise / Math.max(1, income)) * 100)}%</b>
            </span>
          ))}
        </div>
      </div>
      <div className="split-legend">{t(`${formatINR(income)}/month, split like this:`, `${formatINR(income)}/mahina — aise baata:`)}</div>

      {/* compact split */}
      <div className="cv-split">
        {plan.buckets.map((b) => {
          const used = b.id === 'needs' ? spend.needs : b.id === 'fun' ? spend.fun : null;
          const over = used !== null && used > b.allocatedPaise;
          return (
            <div className="csr" key={b.id}>
              <span className={`csr-dot seg-${b.id}`} />
              <span className="csr-name">{BUCKET_EMOJI[b.id]} {t(...BUCKET_LABEL[b.id])}</span>
              {used !== null && <span className="csr-used num" data-tone={over ? 'bad' : undefined}>{formatINR(used)}</span>}
              <span className="csr-amt num">{formatINR(b.allocatedPaise)}</span>
            </div>
          );
        })}
        {investLocked && (
          <div className="csr csr-lock">
            <span className="csr-dot seg-savings" />
            <span className="csr-name">📈 {t('Invest / goal', 'Invest / goal')}</span>
            <span className="csr-amt">🔒</span>
          </div>
        )}
      </div>

      {/* why — chhupa hua, tap karke dekho */}
      <details className="cv-why">
        <summary>{t('Why this split?', 'Ye split kyun?')}</summary>
        {plan.buckets.map((b) => (
          <p key={b.id}><b>{BUCKET_EMOJI[b.id]} {t(...BUCKET_LABEL[b.id])}</b> — {t(...bucketWhy(b.id, plan, profile))}</p>
        ))}
        {investLocked && (
          <p><b>📈 {t('Invest / goal', 'Invest / goal')}</b> — {plan.flags.includes('high_interest_debt')
            ? t('unlocks after the costly loan is cleared.', 'mehnga loan khatam hote hi khulega.')
            : t('unlocks once your emergency fund is full.', 'emergency fund poora hote hi khulega.')}</p>
        )}
      </details>

      {/* aaj ka rule */}
      {pulse && funAlloc > 0 && (
        <div className="cv-rule">
          <span className="cvr-ico">🎯</span>
          <div className="grow">
            <b>{overFun > 0
              ? t('Fun budget is over for this month', 'Is mahine masti-budget khatam')
              : t(`Today you can spend ${formatINR(pulse.safePerDayPaise)} on fun`, `Aaj masti pe ${formatINR(pulse.safePerDayPaise)} tak theek`)}</b>
            <i>{overFun > 0
              ? t('Hold off till next month so the goal stays on track.', 'Agle mahine tak ruk jao — goal patri pe rahe.')
              : t(`${formatINR(pulse.funLeftPaise)} left for ${pulse.daysLeft} days`, `${formatINR(pulse.funLeftPaise)} bacha ${pulse.daysLeft} din ke liye`)}</i>
          </div>
        </div>
      )}

      {/* overspend → plan shift (hard rule + reminder) */}
      {overFun > 0 && (
        <div className="cv-shift">
          <span className="cvs-ico">⚠️</span>
          <div className="grow">
            <b>{t(`You went ${formatINR(overFun)} over on fun`, `Masti me ${formatINR(overFun)} zyada ho gaya`)}</b>
            <p>{t(`New rule: fun stops for now. Next month I'll cap fun at ${formatINR(nextMonthFun)} so your goal doesn't slip. I'll remind you.`, `Naya niyam: abhi masti band. Agle mahine main masti ${formatINR(nextMonthFun)} pe rok dunga taaki goal na tootre. Yaad bhi dila dunga.`)}</p>
          </div>
        </div>
      )}

      {/* emergency fund */}
      <div className="plan-card">
        <div className="pc-top">
          <span className="pc-k">🛟 {t('Emergency fund', 'Emergency fund')}</span>
          <span className="num">{formatINR(plan.emergencyFundPaise)} / {formatINR(plan.emergencyTargetPaise)}</span>
        </div>
        <div className="bar"><i style={{ width: `${Math.min(100, (plan.emergencyFundPaise / Math.max(1, plan.emergencyTargetPaise)) * 100)}%` }} /></div>
        <p className="pc-note">
          {plan.emergencyFundPaise >= plan.emergencyTargetPaise
            ? t('Fully funded — a solid safety net. 💪', 'Poora bhar gaya — mazboot safety. 💪')
            : plan.emergencyMonthsToFull
              ? t(`At this pace, full in about ${plan.emergencyMonthsToFull} months.`, `Is rate pe ~${plan.emergencyMonthsToFull} mahine me full.`)
              : t('Add a little every month.', 'Har mahine thoda daalo.')}
        </p>
      </div>

      {/* goal */}
      {profile.goal && plan.goalMonthlyNeededPaise > 0 && (
        <div className="plan-card">
          <div className="pc-top">
            <span className="pc-k">🎯 {profile.goal.name || t('Your goal', 'Tumhara goal')}</span>
            <span className="num">{formatINR(profile.goal.savedPaise)} / {formatINR(profile.goal.targetPaise)}</span>
          </div>
          <div className="bar"><i style={{ width: `${Math.min(100, (profile.goal.savedPaise / Math.max(1, profile.goal.targetPaise)) * 100)}%` }} /></div>
          <p className="pc-note">
            {plan.goalMonthlyPlannedPaise <= 0
              ? t('Starts once your emergency fund / loan is handled.', 'Emergency fund / loan nipatne ke baad shuru hoga.')
              : plan.goalRealisticMonths && plan.goalRealisticMonths > profile.goal.deadlineMonths
                ? t(`You wanted it in ${profile.goal.deadlineMonths} months, but ${formatINR(plan.goalMonthlyPlannedPaise)}/mo fits — realistically about ${plan.goalRealisticMonths} months.`, `Tumne ${profile.goal.deadlineMonths} mahine socha tha, par ${formatINR(plan.goalMonthlyPlannedPaise)}/mahina fit hota — sach me ~${plan.goalRealisticMonths} mahine.`)
                : t(`Putting ${formatINR(plan.goalMonthlyPlannedPaise)} a month — on track. ✅`, `${formatINR(plan.goalMonthlyPlannedPaise)}/mahina ja raha — on track. ✅`)}
          </p>

          {/* daily-save + time-to-reach — specific, general nahi */}
          <div className="goal-analysis">
            <div className="ga-cell">
              <span className="ga-k">{t('Save daily', 'Roz bachao')}</span>
              <b className="num">{formatINR(Math.ceil(plan.goalMonthlyNeededPaise / 30))}</b>
              <span className="ga-s">{t(`to hit ${profile.goal.deadlineMonths}-mo target`, `${profile.goal.deadlineMonths}-mah target ke liye`)}</span>
            </div>
            <div className="ga-cell">
              <span className="ga-k">{t('At your rate', 'Is rate pe')}</span>
              <b className="num">{plan.goalMonthlyPlannedPaise > 0 && plan.goalRealisticMonths ? t(`~${plan.goalRealisticMonths} mo`, `~${plan.goalRealisticMonths} mah`) : '—'}</b>
              <span className="ga-s">{t('to reach it', 'me poora hoga')}</span>
            </div>
          </div>
        </div>
      )}

      <p className="plan-foot">{t('This is guidance from simple money rules — not licensed financial advice.', 'Ye seedhe paise-niyam se salah hai — koi licensed financial advice nahi.')}</p>
    </div>
  );
}

/* ---------- salary donut graph ---------- */

const BUCKET_HEX: Record<BucketId, string> = {
  needs: '#6b7cff', debt: '#ef4444', emergency: '#35c4e8', savings: '#22c55e', fun: '#a3e635', buffer: '#9ca3af',
};

function Donut({ buckets, income }: { buckets: MoneyPlan['buckets']; income: number }) {
  const total = Math.max(1, income);
  const R = 42;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <svg viewBox="0 0 100 100" className="donut" role="img" aria-hidden="true">
      <circle cx="50" cy="50" r={R} className="donut-track" fill="none" strokeWidth="13" />
      {buckets.map((b) => {
        const len = (b.allocatedPaise / total) * C;
        const seg = (
          <circle
            key={b.id} cx="50" cy="50" r={R} fill="none" stroke={BUCKET_HEX[b.id]} strokeWidth="13"
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dasharray .8s var(--ease-out)' }}
          />
        );
        acc += len;
        return seg;
      })}
      <text x="50" y="49" textAnchor="middle" className="donut-big">{formatShort(income)}</text>
      <text x="50" y="62" textAnchor="middle" className="donut-sub">/mo</text>
    </svg>
  );
}

/* ---------- coach copy (deterministic, situation-aware) ---------- */

function readSituation(plan: MoneyPlan, t: (e: string, h: string) => string): string {
  const inc = formatINR(plan.incomePaise);
  const fixed = formatINR(plan.mandatoryNeedsPaise);
  const left = formatINR(Math.max(0, plan.disposablePaise));
  if (plan.disposablePaise <= 0) {
    return t(`${inc} comes in, but ${fixed} goes to fixed costs — nothing's left to split. Let's ease the pressure first.`, `${inc} aata hai, par ${fixed} zaroori kharche me chala jaata — baantne ko kuch bachta hi nahi. Pehle bojh halka karte hain.`);
  }
  return t(`${inc} comes in. ${fixed} is fixed, so ${left} is really in your hands. Here's how I'd use it 👇`, `${inc} aata hai. ${fixed} zaroori hai, matlab ${left} asli tumhare haath me. Main ise aise lagata 👇`);
}

function bucketWhy(id: BucketId, plan: MoneyPlan, _p: MoneyProfile): [string, string] {
  switch (id) {
    case 'needs':
      return plan.emiTotalPaise > 0
        ? [`Rent, bills, ration + ${formatINR(plan.emiTotalPaise)} EMI — the roof over everything.`, `Rent, bill, ration + ${formatINR(plan.emiTotalPaise)} EMI — inke bina mahina nahi chalta.`]
        : ['Rent, bills, ration — these come first, always.', 'Rent, bill, ration — ye pehle, hamesha.'];
    case 'debt':
      return ['Extra toward the costly loan — its interest is eating you.', 'Mehnga loan pehle — uska byaaj tumhe kha raha hai.'];
    case 'emergency':
      return [`Your cushion for a job loss or a medical shock — building to ${formatINR(plan.emergencyTargetPaise)}.`, `Naukri chhoot jaye ya medical jhatka — uske liye. ${formatINR(plan.emergencyTargetPaise)} tak le jaana hai.`];
    case 'savings':
      return ['Now your money grows — invest and chase the goal.', 'Ab paisa badhega — invest aur goal ke liye.'];
    case 'fun':
      return ['Life matters too — guilt-free. Just don\'t cross it.', 'Zindagi bhi zaroori — bina guilt. Bas isse upar mat jao.'];
    case 'buffer':
      return ['Leftover slack — a little breathing room.', 'Bacha-khucha — thodi saans lene ki jagah.'];
  }
}

