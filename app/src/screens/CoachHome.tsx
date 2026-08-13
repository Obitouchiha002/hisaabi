import { useEffect, useMemo, useRef, useState } from 'react';
import { buildMoneyPlan, formatINR, toPaise, toRupees, type DraftEntry, type MoneyPlan } from '@engine';
import { Icon, Sheet, useToast } from '@/components/ui';
import { useStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { addressWord } from '@/lib/profile';
import { loadMoneyProfile, planPulse, monthlyBucketSpend } from '@/lib/moneyProfile';
import { getBalance, setBalance, type Balance } from '@/lib/balance';
import { peekGap, greetedToday, markActive, markGreeted, getStreak } from '@/lib/streak';
import { todayQuote } from '@/lib/quotes';
import { dueBills, markLogged } from '@/lib/recurring';
import { coachReply } from '@/lib/ai';
import { loadChat, saveChat } from '@/lib/chatlog';
import { AddSheet } from './AddEntry';
import { Settings } from './Settings';

/**
 * CoachHome — naya premium home. Sabse upar tumhari saaf position (kamai / jeb
 * me / kharch), beech me coach se baat (yehi main feature), neeche ek input.
 * Kharcha likho ya kuch bhi poocho — coach seedha jawab deta hai.
 */

interface Msg { id: number; role: 'coach' | 'me'; text: string; sub?: string }

const LOW_PAISE = 10000;   // ₹100 se neeche → red alert

export function CoachHome() {
  const t = useT();
  const store = useStore();
  const { profile, entries, budget, engine, commitDrafts, setRoute, pending } = store;

  const moneyProfile = useMemo(() => loadMoneyProfile(), []);
  const earning = moneyProfile?.incomePaise ?? 0;
  const spent = budget.spentThisMonthPaise;
  const daysToSalary = moneyProfile?.salaryDay ? daysUntil(moneyProfile.salaryDay) : null;
  const plan = useMemo(() => (moneyProfile ? buildMoneyPlan(moneyProfile) : null), [moneyProfile]);
  const pulse = useMemo(() => (plan ? planPulse(plan, entries) : null), [plan, entries]);

  const [bal, setBal] = useState<Balance | null>(() => getBalance());
  const [editBal, setEditBal] = useState(false);
  const [sheet, setSheet] = useState<'type' | 'voice' | 'settings' | null>(null);
  const toast = useToast();

  const [msgs, setMsgs] = useState<Msg[]>(() => loadChat().map((m, i) => ({ ...m, id: i + 1 })));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seedRef = useRef(false);
  const gapRef = useRef<number | null>(peekGap());

  // chat history save (reload/reinstall pe bani rahe)
  useEffect(() => { saveChat(msgs.map(({ role, text, sub }) => ({ role, text, sub }))); }, [msgs]);

  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') ?? 'dark');
  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('hisaabi-theme', next);
    setTheme(next);
  }

  useEffect(() => { markActive(); }, []);

  // recurring bills — jo is mahine due ho chuke, khud log kar do (ek baar)
  useEffect(() => {
    const due = dueBills();
    if (!due.length) return;
    const drafts = due.map((b): DraftEntry => ({
      title: b.title, amountPaise: b.amountPaise, type: 'expense', paidWith: 'unknown',
      occurredAt: new Date().toISOString(), source: 'manual', category: b.category, confidence: 1, warnings: [],
    }));
    void commitDrafts(drafts);
    due.forEach((b) => markLogged(b.id));
    const total = due.reduce((s, b) => s + b.amountPaise, 0);
    const cur = getBalance();
    if (cur) setBal(setBalance(Math.max(0, cur.paise - total)));
    const id = setTimeout(() => push({ role: 'coach', text: t(`📌 Auto-logged ${due.length} recurring ${due.length === 1 ? 'bill' : 'bills'} due this month.`, `📌 ${due.length} har-mahine wale bill is mahine ke khud log kar diye.`), sub: `−${formatINR(total)}` }), 120);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // greeting — sirf agar aaj greet nahi hua (warna purani chat bani rahe)
  useEffect(() => {
    if (seedRef.current) return;
    seedRef.current = true;
    if (greetedToday() && msgs.length > 0) return;   // continuity: purani baat rakho
    const g = greetText(gapRef.current, getStreak(), profile ? addressWord(profile) : 'dost', t, !greetedToday());
    markGreeted();
    push({ role: 'coach', text: g });
    const ins = pickProactive();   // ek sabse zaroori proactive baat
    if (ins) setTimeout(() => push({ role: 'coach', text: ins }), 500);
  }, [profile, t]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy]);

  const nextId = useRef(loadChat().length + 1);
  function push(m: Omit<Msg, 'id'>) { setMsgs((cur) => [...cur, { ...m, id: nextId.current++ }]); }

  async function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setInput('');
    push({ role: 'me', text });
    setBusy(true);
    try {
      // "5000 ka phone lu?" — kharcha-salah? Log karne se pehle goal-aware jawab do.
      const adv = spendAdviceIntent(text);
      if (adv) {
        push({ role: 'coach', text: spendAdvice(adv.amountPaise, plan, pulse, t) });
        setBusy(false);
        return;
      }
      const res = await engine.handle(text, entries, { source: 'manual' });
      if (res.intent === 'expense' && res.drafts.length) {
        await commitDrafts(res.drafts);
        const inFlow = res.drafts.filter((d) => d.type === 'income' || d.type === 'cash_in' || d.type === 'refund' || d.type === 'borrowed').reduce((s, d) => s + d.amountPaise, 0);
        const outFlow = res.drafts.filter((d) => d.type === 'expense' || d.type === 'lent').reduce((s, d) => s + d.amountPaise, 0);
        const names = res.drafts.map((d: DraftEntry) => d.title).join(', ');
        const newBal = applyToBalance(res.drafts);   // jeb + aaya − gaya

        if (inFlow > 0 && outFlow === 0) {
          push({ role: 'coach', text: t(`Nice — +${formatINR(inFlow)} in · ${names}`, `Badhiya — +${formatINR(inFlow)} aaya · ${names}`) });
        } else {
          push({ role: 'coach', text: t(`Logged ✅ ${names}`, `Likh liya ✅ ${names}`), sub: outFlow > 0 ? `−${formatINR(outFlow)}` : undefined });
        }
        // passbook — har baar running balance
        if (newBal !== null) {
          push({ role: 'coach', text: t(`In hand now: ${formatINR(newBal)}`, `Ab jeb me: ${formatINR(newBal)}`) });
          if (newBal <= 0) push({ role: 'coach', text: t("😬 Nothing left in hand — add cash before spending more.", '😬 Jeb khaali — aur kharch se pehle cash daalo.') });
          else if (newBal < LOW_PAISE) push({ role: 'coach', text: t(`⚠️ Only ${formatINR(newBal)} left — go easy now.`, `⚠️ Sirf ${formatINR(newBal)} bacha — ab sambhal ke.`) });
        } else {
          push({ role: 'coach', text: t('Tip: set your cash in hand (tap 💰 up top) and I\'ll keep a running total like a passbook.', 'Tip: apna cash in hand set karo (upar 💰 tap) — main passbook jaisa running total rakhunga.') });
        }
      } else if (res.intent === 'question' && res.answer) {
        push({ role: 'coach', text: res.answer.answer });
      } else {
        // baaki sab (baat-cheet, salah, "trip jaana hai", "tang aa gaya") → AI coach, tumhare hisaab pe
        const reply = await coachReply(text, buildSnapshot(), recentHistory());
        push({ role: 'coach', text: reply ?? t("I didn't catch a spend or question. Try again, or make a plan so I can advise.", 'Kuch samajh nahi aaya. Dobara likho, ya plan banao taaki salah du.') });
      }
    } catch {
      push({ role: 'coach', text: t('Something went wrong — try once more.', 'Kuch gadbad ho gayi — ek baar aur.') });
    }
    setBusy(false);
  }

  /** Jeb (in hand) ko kharche/kamai ke hisaab se badlo. balance set hai tabhi. */
  function applyToBalance(drafts: DraftEntry[]): number | null {
    if (!bal) return null;
    let delta = 0;
    for (const d of drafts) {
      if (d.type === 'expense' || d.type === 'lent') delta -= d.amountPaise;         // paisa jeb se gaya
      else if (d.type === 'income' || d.type === 'refund' || d.type === 'cash_in' || d.type === 'borrowed') delta += d.amountPaise;  // jeb me aaya
    }
    if (delta === 0) return bal.paise;
    const next = Math.max(0, bal.paise + delta);
    setBal(setBalance(next));
    return next;
  }

  /** AI coach ko dene ke liye user ka asli hisaab (amount+category, koi naam nahi). */
  function buildSnapshot(): string {
    const L: string[] = [];
    if (earning > 0) L.push(`Monthly income: ${formatINR(earning)}${moneyProfile?.salaryDay ? `, salary day ${moneyProfile.salaryDay}${daysToSalary !== null ? ` (next salary in ${daysToSalary} days)` : ''}` : ''}`);
    L.push(`Cash in hand right now: ${bal ? formatINR(bal.paise) : 'not set yet'}`);
    L.push(`Spent so far this month: ${formatINR(spent)}`);
    if (plan) {
      const nd = plan.buckets.find((b) => b.id === 'needs')?.allocatedPaise ?? 0;
      const fn = plan.buckets.find((b) => b.id === 'fun')?.allocatedPaise ?? 0;
      L.push(`Monthly plan: needs ${formatINR(nd)}, fun ${formatINR(fn)}, emergency+savings ${formatINR(boxes?.emergency ?? 0)}`);
      L.push(`Emergency fund: ${formatINR(plan.emergencyFundPaise)} of ${formatINR(plan.emergencyTargetPaise)}`);
    }
    if (boxes) L.push(`Left this month: fixed box ${formatINR(boxes.fixedLeft)}, daily+fun box ${formatINR(boxes.dailyLeft)}`);
    if (pulse && (plan?.buckets.find((b) => b.id === 'fun')?.allocatedPaise ?? 0) > 0) L.push(`Fun money left: ${formatINR(pulse.funLeftPaise)} for ${pulse.daysLeft} days (${formatINR(pulse.safePerDayPaise)}/day safe)`);
    if (moneyProfile?.goal) L.push(`Goal: ${moneyProfile.goal.name ?? 'a saving goal'} — ${formatINR(moneyProfile.goal.savedPaise)} of ${formatINR(moneyProfile.goal.targetPaise)} in ${moneyProfile.goal.deadlineMonths} months`);
    L.push(`Spend split this month: needs ${formatINR(spendBuckets.needs)}, fun ${formatINR(spendBuckets.fun)}, other ${formatINR(spendBuckets.other)}`);
    return L.join('\n');
  }
  function recentHistory(): string {
    return msgs.slice(-6).map((m) => `${m.role === 'coach' ? 'Coach' : 'User'}: ${m.text}`).join('\n');
  }

  /** Proactive — coach khud sabse zaroori baat bole (din me ek baar). */
  function pickProactive(): string | null {
    const streak = getStreak();
    if (pulse && pulse.overspentPaise > 0) return t(`⚠️ You're ${formatINR(pulse.overspentPaise)} over your fun budget this month — ease up so the goal stays on track.`, `⚠️ Is mahine masti-budget se ${formatINR(pulse.overspentPaise)} upar ho — thoda dhyan, goal patri pe rahe.`);
    if (boxes && boxes.daily > 0 && boxes.dailyLeft < 10000) return t(`👛 Only ${formatINR(boxes.dailyLeft)} left in your daily+fun box — go easy till payday.`, `👛 Daily+fun box me sirf ${formatINR(boxes.dailyLeft)} bacha — salary tak sambhal ke.`);
    if (daysToSalary !== null && daysToSalary > 3 && bal && bal.paise / daysToSalary < 5000) return t(`📅 ${daysToSalary} days till salary and ${formatINR(bal.paise)} in hand — about ${formatINR(Math.floor(bal.paise / daysToSalary))}/day. Tight; plan carefully.`, `📅 Salary ${daysToSalary} din door, jeb me ${formatINR(bal.paise)} — roz ~${formatINR(Math.floor(bal.paise / daysToSalary))}. Tight hai, dhyan se.`);
    if (streak >= 3) return t(`🔥 ${streak}-day logging streak — you're building a real habit. Keep it up!`, `🔥 ${streak} din se lagataar likh rahe ho — aadat ban rahi hai. Aise hi chalo!`);
    if (spendBuckets.fun + spendBuckets.other > 20000) return t(`👀 Flexible spend (fun/other) is ${formatINR(spendBuckets.fun + spendBuckets.other)} this month — the easiest place to save.`, `👀 Is mahine flexible kharcha ${formatINR(spendBuckets.fun + spendBuckets.other)} — yahi se bachat sabse aasaan.`);
    if (moneyProfile?.goal && plan && plan.goalMonthlyPlannedPaise > 0) return t(`🎯 On track for your goal — ${formatINR(plan.goalMonthlyPlannedPaise)} going in this month.`, `🎯 Goal patri pe — is mahine ${formatINR(plan.goalMonthlyPlannedPaise)} ja raha.`);
    return null;
  }

  const lowHand = bal !== null && bal.paise < LOW_PAISE;
  const funPct = earning > 0 ? Math.min(100, (spent / earning) * 100) : 0;
  const quote = useMemo(() => todayQuote(), []);

  // 3-box envelope — salary ka bantwara: emergency / fixed / daily+fun
  const spendBuckets = useMemo(() => monthlyBucketSpend(entries), [entries]);
  const boxes = useMemo(() => {
    if (!plan) return null;
    const sum = (ids: string[]) => plan.buckets.filter((b) => ids.includes(b.id)).reduce((s, b) => s + b.allocatedPaise, 0);
    const emergency = sum(['emergency', 'savings', 'debt']);
    const fixed = plan.buckets.find((b) => b.id === 'needs')?.allocatedPaise ?? 0;
    const daily = sum(['fun', 'buffer']);
    return {
      emergency,
      fixed, fixedLeft: Math.max(0, fixed - spendBuckets.needs),
      daily, dailyLeft: Math.max(0, daily - spendBuckets.fun - spendBuckets.other),
    };
  }, [plan, spendBuckets]);

  return (
    <div className="screen chome">
      {/* header */}
      <header className="chome-top">
        <div className="grow">
          <div className="greet">{t('Your coach', 'Tera coach')}</div>
          <div className="name">{profile ? addressWord(profile) : t('friend', 'dost')}</div>
        </div>
        {pending.length > 0 && (
          <button className="icon-btn badge-btn" onClick={() => setRoute('review')} aria-label={t('Review', 'Review')}>
            {Icon.inbox}<span className="badge-dot num">{pending.length}</span>
          </button>
        )}
        <button className="icon-btn" onClick={() => setRoute('trips')} aria-label={t('Groups', 'Groups')}>{Icon.users}</button>
        <button className="icon-btn" onClick={toggleTheme} aria-label={t('Theme', 'Theme')}>{theme === 'light' ? Icon.moon : Icon.sun}</button>
        <button className="icon-btn" onClick={() => setSheet('settings')} aria-label={t('Settings', 'Settings')}>{Icon.settings}</button>
      </header>

      {/* position — saaf: kamai / jeb me / kharch */}
      <div className="pos-card">
        <button className="pos-cell" data-low={lowHand ? '' : undefined} onClick={() => setEditBal(true)}>
          <span className="pos-k">💰 {t('In hand', 'Jeb me')}</span>
          <span className="pos-v num" data-tone={lowHand ? 'bad' : undefined}>{bal ? formatINR(bal.paise) : t('Set', 'Set karo')}</span>
          <span className="pos-edit">{bal ? (lowHand ? t('⚠️ running low', '⚠️ kam ho raha') : t('tap to update', 'tap karke badlo')) : t('tap to set', 'tap karke set karo')}</span>
        </button>
        <div className="pos-cell" role="button" tabIndex={0} onClick={() => setRoute('plan')}>
          <span className="pos-k">📥 {t('Earning', 'Kamai')}</span>
          <span className="pos-v num">{earning > 0 ? formatINR(earning) : '—'}</span>
          <span className="pos-edit">{earning > 0 ? t('a month', 'mahina') : t('set a plan', 'plan banao')}</span>
        </div>
        <button className="pos-cell" onClick={() => setRoute('report')}>
          <span className="pos-k">📤 {t('Spent', 'Kharch')}</span>
          <span className="pos-v num" data-tone={budget.status === 'over' ? 'bad' : undefined}>{formatINR(spent)}</span>
          <span className="pos-edit">{t('this month', 'is mahine')}</span>
        </button>
        {earning > 0 && <div className="pos-bar"><i style={{ width: `${funPct}%` }} data-tone={budget.status === 'over' ? 'bad' : undefined} /></div>}
      </div>

      {/* 3-box envelope — salary ka bantwara */}
      {boxes && (
        <div className="box-row">
          <div className="mbox b-em">
            <span className="mbox-k">🛟 {t('Emergency', 'Emergency')}</span>
            <span className="mbox-v num">{formatINR(boxes.emergency)}</span>
            <span className="mbox-s">{t('saved / mo', 'bachat / mah')}</span>
          </div>
          <div className="mbox b-fix">
            <span className="mbox-k">🏠 {t('Fixed', 'Zaroori')}</span>
            <span className="mbox-v num">{formatINR(boxes.fixedLeft)}</span>
            <span className="mbox-s">{t(`of ${formatINR(boxes.fixed)}`, `${formatINR(boxes.fixed)} me se`)}</span>
          </div>
          <div className="mbox b-day" data-low={boxes.dailyLeft < LOW_PAISE ? '' : undefined}>
            <span className="mbox-k">🎉 {t('Daily + fun', 'Rozana')}</span>
            <span className="mbox-v num">{formatINR(boxes.dailyLeft)}</span>
            <span className="mbox-s">{t(`of ${formatINR(boxes.daily)}`, `${formatINR(boxes.daily)} me se`)}</span>
          </div>
        </div>
      )}

      {/* next salary countdown — roz kitna safe */}
      {daysToSalary !== null && (
        <div className="salary-strip" data-low={bal && daysToSalary > 0 && bal.paise / daysToSalary < 5000 ? '' : undefined}>
          📅 {daysToSalary === 0
            ? t('Salary lands today', 'Aaj salary aayegi')
            : t(`Next salary in ${daysToSalary} ${daysToSalary === 1 ? 'day' : 'days'}`, `Agli salary ${daysToSalary} din me`)}
          {bal && daysToSalary > 0 && (
            <b> · {t(`${formatINR(Math.floor(bal.paise / daysToSalary))}/day safe`, `roz ${formatINR(Math.floor(bal.paise / daysToSalary))} safe`)}</b>
          )}
        </div>
      )}

      {/* coach chat — main feature */}
      <div className="chome-chat" ref={scrollRef}>
        <div className="chome-quote">
          <p>“{quote.text}”</p>
          <span className="cq-author">— {quote.author}</span>
        </div>
        {msgs.map((m) => (
          <div className={`bubble b-${m.role === 'coach' ? 'coach' : 'me'} b-fresh`} key={m.id}>
            {m.role === 'coach' && <span className="b-face">🦉</span>}
            <span className="b-text">{m.text}{m.sub && <b className="b-amt num"> {m.sub}</b>}</span>
          </div>
        ))}
        {busy && (
          <div className="bubble b-coach"><span className="b-face">🦉</span><span className="b-text b-typing"><i></i><i></i><i></i></span></div>
        )}
      </div>

      {/* quick prompts */}
      {msgs.length <= 1 && (
        <div className="chome-hints">
          {[t('chai 20, auto 60', 'chai 20, auto 60'), t('how much this month?', 'is mahine kitna gaya?'), t('my plan', 'mera plan')].map((h) => (
            <button key={h} className="chip" onClick={() => void send(h)}>{h}</button>
          ))}
        </div>
      )}

      {/* input dock */}
      <div className="chome-dock">
        <input
          className="chome-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
          placeholder={t('Log a spend or ask anything…', 'Kharcha likho ya kuch bhi poocho…')}
          inputMode="text"
        />
        {input.trim()
          ? <button className="chome-send" onClick={() => void send()} aria-label={t('Send', 'Bhejo')}>↑</button>
          : <button className="chome-mic" onClick={() => setSheet('voice')} aria-label={t('Speak', 'Bolo')}>{Icon.mic}</button>}
      </div>

      {/* balance editor */}
      {editBal && (
        <Sheet onClose={() => setEditBal(false)}>
          <BalanceEditor
            initial={bal?.paise ?? 0}
            onSave={(p) => { setBal(setBalance(p)); setEditBal(false); toast.show(t('Updated ✅', 'Update ✅')); }}
          />
        </Sheet>
      )}

      {(sheet === 'type' || sheet === 'voice') && (
        <AddSheet
          mode={sheet}
          onClose={() => setSheet(null)}
          onSaved={(count, total) => {
            setSheet(null);
            if (bal && total > 0) setBal(setBalance(Math.max(0, bal.paise - total)));   // jeb se minus
            push({ role: 'coach', text: t(`Logged ✅ ${count} ${count === 1 ? 'entry' : 'entries'}`, `Likh liya ✅ ${count} ${count === 1 ? 'entry' : 'entries'}`), sub: formatINR(total) });
          }}
        />
      )}
      {sheet === 'settings' && <Settings onClose={() => setSheet(null)} />}
      {toast.node}
    </div>
  );
}

/* ---------- balance editor (slider, no typing) ---------- */
function BalanceEditor({ initial, onSave }: { initial: number; onSave(paise: number): void }) {
  const t = useT();
  const [v, setV] = useState(toRupees(initial));
  const max = 500000;
  return (
    <div className="balance-editor">
      <h3>{t('Money in hand right now', 'Abhi jeb me kitna')}</h3>
      <label className="be-val"><span className="sv-cur">₹</span>
        <input className="sv-input num" inputMode="numeric" placeholder="0"
               value={v ? v.toLocaleString('en-IN') : ''}
               onChange={(e) => setV(Math.min(max, Number(e.target.value.replace(/[^\d]/g, '')) || 0))} />
      </label>
      <div className="slider-wrap">
        <button className="step-b" onClick={() => setV(Math.max(0, v - 500))} aria-label="−">−</button>
        <input className="slider" type="range" min={0} max={max} step={500} value={Math.min(v, max)}
               style={{ ['--pct' as string]: `${(Math.min(v, max) / max) * 100}%` }} onChange={(e) => setV(Number(e.target.value))} />
        <button className="step-b" onClick={() => setV(v + 500)} aria-label="+">+</button>
      </div>
      <div className="be-quick">
        {[100, 500, 1000, 2000].map((q) => <button key={q} className="chip" onClick={() => setV(v + q)}>+{q}</button>)}
      </div>
      <button className="btn btn-primary btn-block" onClick={() => onSave(toPaise(v))}>{t('Save', 'Save karo')}</button>
    </div>
  );
}

/* ---------- spend advice: "5000 ka phone lu?" → goal-aware jawab ---------- */

const ADVICE_RE = /\b(lu|loon|lun|le\s*lu|le\s*lun|lena|kharid|khareed|kharee?dun|should\s*i|kar\s*(?:sakta|sakti|lu|lun)|sahi\s*(?:rahega|hai)|thik|theek|man\s*hai|chahiye|worth|afford)\b/i;

/** Advice-sawaal + amount hai to nikaal do; warna null (normal log/parse). */
function spendAdviceIntent(text: string): { amountPaise: number } | null {
  const isAsk = text.includes('?') || ADVICE_RE.test(text);
  if (!isAsk) return null;
  const m = text.toLowerCase().match(/(?:₹|rs\.?|rupees?)?\s*(\d[\d,]*)\s*(k|hazaar|hazar|thousand|lakh)?/);
  if (!m) return null;
  let n = Number(m[1].replace(/,/g, ''));
  if (m[2] === 'lakh') n *= 100000;
  else if (m[2]) n *= 1000;
  if (!n || n <= 0) return null;
  return { amountPaise: Math.round(n * 100) };
}

function spendAdvice(amountPaise: number, plan: MoneyPlan | null, pulse: ReturnType<typeof planPulse> | null, t: (e: string, h: string) => string): string {
  const f = formatINR;
  if (!plan || !pulse) {
    return t(`For ${f(amountPaise)} — set up your plan first (tap 'Earning' → make a plan) and I'll tell you if it fits your goal.`, `${f(amountPaise)} ke liye — pehle plan banao ('Kamai' tap karke), phir main batata hu goal ke hisaab se sahi hai ya nahi.`);
  }
  const funLeft = pulse.funLeftPaise;
  const safeDay = pulse.safePerDayPaise;
  if (amountPaise <= funLeft) {
    // bade shauk pe 48-ghante ka niyam
    const big = amountPaise >= 100000 || amountPaise > funLeft * 0.6;
    const tail = big ? t(' Big one though — sleep on it 48 hours; if you still want it tomorrow, go ahead.', ' Bada hai — 48 ghante ruko; kal bhi mann kare to le lo.') : '';
    return t(`Go for it 👍 ${f(amountPaise)} fits — you've still got ${f(funLeft)} of fun money this month.${tail}`, `Le lo 👍 ${f(amountPaise)} theek hai — is mahine abhi ${f(funLeft)} masti ka paisa bacha hai.${tail}`);
  }
  const over = amountPaise - funLeft;
  const emHit = plan.emergencyFundPaise < plan.emergencyTargetPaise
    ? t(' — the extra comes out of your savings, so your emergency fund slips back.', ' — extra bachat se jayega, matlab emergency fund peeche khisak jayega.')
    : t(' — the extra comes out of your savings.', ' — extra bachat se jayega.');
  return t(`Careful ⚠️ that's ${f(over)} over this month's fun budget (only ${f(funLeft)} left)${emHit} Try the 48-hour rule: wait 2 days — if you still want it, then buy. Today only ${f(safeDay)} is truly safe.`, `Ruk jao ⚠️ ye is mahine ke masti-budget se ${f(over)} zyada hai (sirf ${f(funLeft)} bacha)${emHit} 48-ghante ka niyam: 2 din ruko — phir bhi mann kare to lo. Aaj sirf ${f(safeDay)} tak safe hai.`);
}

/** Aaj se salary-din tak kitne din (agle mahine wrap). */
function daysUntil(salaryDay: number, now = new Date()): number {
  const today = now.getDate();
  if (salaryDay >= today) return salaryDay - today;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return daysInMonth - today + salaryDay;
}

/* ---------- greeting text (streak mood) ---------- */
function greetText(gap: number | null, streak: number, name: string, t: (e: string, h: string) => string, firstToday: boolean): string {
  if (!firstToday) return t(`Hey ${name} — log a spend or ask me anything.`, `Hey ${name} — kharcha likho ya kuch bhi poocho.`);
  if (gap === null) return t(`Hi ${name}! 🦉 I'm your money coach. Tell me what you've spent so far, or ask me anything.`, `Hi ${name}! 🦉 Main tera paisa-coach. Batao ab tak kya kharch kiya, ya kuch bhi poocho.`);
  if (gap <= 1) return t(`Welcome back, ${name}! 🔥 ${streak}-day streak. What did you spend?`, `Wapas aa gaye, ${name}! 🔥 ${streak} din se. Kya kharch kiya?`);
  if (gap <= 4) return t(`Back after ${gap} days — no worries. Let's catch up: what did you spend?`, `${gap} din baad aaye — koi baat nahi. Chalo pakad lete hai: kya kharch hua?`);
  if (gap <= 9) return t(`It's been ${gap} days, ${name}. Remember your goal? Let's log it.`, `${gap} din ho gaye, ${name}. Goal yaad hai na? Chalo note karte hai.`);
  return t(`${gap} days gone 😤 Doesn't look like you're serious about your goal. Here now? Then log your spends.`, `${gap} din gayab 😤 Lagta hai goal ke liye serious nahi ho. Aaye ho to hisaab likho.`);
}
