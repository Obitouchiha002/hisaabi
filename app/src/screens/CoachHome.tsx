import { useEffect, useMemo, useRef, useState } from 'react';
import { formatINR, toPaise, toRupees, type DraftEntry } from '@engine';
import { Icon, Sheet, useToast } from '@/components/ui';
import { useStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { addressWord } from '@/lib/profile';
import { loadMoneyProfile } from '@/lib/moneyProfile';
import { getBalance, setBalance, type Balance } from '@/lib/balance';
import { peekGap, greetedToday, markActive, markGreeted, getStreak } from '@/lib/streak';
import { AddSheet } from './AddEntry';
import { Settings } from './Settings';

/**
 * CoachHome — naya premium home. Sabse upar tumhari saaf position (kamai / jeb
 * me / kharch), beech me coach se baat (yehi main feature), neeche ek input.
 * Kharcha likho ya kuch bhi poocho — coach seedha jawab deta hai.
 */

interface Msg { id: number; role: 'coach' | 'me'; text: string; sub?: string }

export function CoachHome() {
  const t = useT();
  const store = useStore();
  const { profile, entries, budget, engine, commitDrafts, setRoute, pending } = store;

  const moneyProfile = useMemo(() => loadMoneyProfile(), []);
  const earning = moneyProfile?.incomePaise ?? 0;
  const spent = budget.spentThisMonthPaise;

  const [bal, setBal] = useState<Balance | null>(() => getBalance());
  const [editBal, setEditBal] = useState(false);
  const [sheet, setSheet] = useState<'type' | 'voice' | 'settings' | null>(null);
  const toast = useToast();

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seedRef = useRef(false);
  const gapRef = useRef<number | null>(peekGap());

  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') ?? 'dark');
  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('hisaabi-theme', next);
    setTheme(next);
  }

  useEffect(() => { markActive(); }, []);

  // pehla coach message — greeting (streak ke hisaab se)
  useEffect(() => {
    if (seedRef.current) return;
    seedRef.current = true;
    const g = greetText(gapRef.current, getStreak(), profile ? addressWord(profile) : 'dost', t, !greetedToday());
    markGreeted();
    setMsgs([{ id: 1, role: 'coach', text: g }]);
  }, [profile, t]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy]);

  const nextId = useRef(2);
  function push(m: Omit<Msg, 'id'>) { setMsgs((cur) => [...cur, { ...m, id: nextId.current++ }]); }

  async function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setInput('');
    push({ role: 'me', text });
    setBusy(true);
    try {
      const res = await engine.handle(text, entries, { source: 'manual' });
      if (res.intent === 'expense' && res.drafts.length) {
        await commitDrafts(res.drafts);
        const total = res.drafts.reduce((s: number, d: DraftEntry) => s + (d.type === 'expense' ? d.amountPaise : 0), 0);
        const names = res.drafts.map((d: DraftEntry) => d.title).join(', ');
        push({ role: 'coach', text: t(`Logged ✅ ${names}`, `Likh liya ✅ ${names}`), sub: total > 0 ? formatINR(total) : undefined });
      } else if (res.intent === 'question') {
        push({ role: 'coach', text: res.answer?.answer ?? t("I didn't get that — try again.", 'Samajh nahi aaya — dobara likho.') });
      } else if (res.intent === 'trip') {
        push({ role: 'coach', text: t('For a group trip, open the Trips section.', 'Group trip ke liye Trips section kholo.') });
      } else {
        push({ role: 'coach', text: t("I didn't catch a spend or a question there.", 'Usme koi kharcha ya sawaal samajh nahi aaya.') });
      }
    } catch {
      push({ role: 'coach', text: t('Something went wrong — try once more.', 'Kuch gadbad ho gayi — ek baar aur.') });
    }
    setBusy(false);
  }

  const funPct = earning > 0 ? Math.min(100, (spent / earning) * 100) : 0;

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
        <button className="pos-cell" onClick={() => setEditBal(true)}>
          <span className="pos-k">💰 {t('In hand', 'Jeb me')}</span>
          <span className="pos-v num">{bal ? formatINR(bal.paise) : t('Set', 'Set karo')}</span>
          <span className="pos-edit">{t('tap to update', 'tap karke badlo')}</span>
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

      {/* coach chat — main feature */}
      <div className="chome-chat" ref={scrollRef}>
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
      <div className="be-val num">{formatINR(toPaise(v))}</div>
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

/* ---------- greeting text (streak mood) ---------- */
function greetText(gap: number | null, streak: number, name: string, t: (e: string, h: string) => string, firstToday: boolean): string {
  if (!firstToday) return t(`Hey ${name} — log a spend or ask me anything.`, `Hey ${name} — kharcha likho ya kuch bhi poocho.`);
  if (gap === null) return t(`Hi ${name}! 🦉 I'm your money coach. Tell me what you've spent so far, or ask me anything.`, `Hi ${name}! 🦉 Main tera paisa-coach. Batao ab tak kya kharch kiya, ya kuch bhi poocho.`);
  if (gap <= 1) return t(`Welcome back, ${name}! 🔥 ${streak}-day streak. What did you spend?`, `Wapas aa gaye, ${name}! 🔥 ${streak} din se. Kya kharch kiya?`);
  if (gap <= 4) return t(`Back after ${gap} days — no worries. Let's catch up: what did you spend?`, `${gap} din baad aaye — koi baat nahi. Chalo pakad lete hai: kya kharch hua?`);
  if (gap <= 9) return t(`It's been ${gap} days, ${name}. Remember your goal? Let's log it.`, `${gap} din ho gaye, ${name}. Goal yaad hai na? Chalo note karte hai.`);
  return t(`${gap} days gone 😤 Doesn't look like you're serious about your goal. Here now? Then log your spends.`, `${gap} din gayab 😤 Lagta hai goal ke liye serious nahi ho. Aaye ho to hisaab likho.`);
}
