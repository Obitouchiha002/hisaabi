import { useEffect, useMemo, useRef, useState } from 'react';
import { dayRange, monthRange, formatINR, toPaise, toRupees, type CategoryId, type Entry } from '@engine';
import { Amount, Icon, Sheet, useToast } from '@/components/ui';
import { EntryEditor } from '@/components/EntryEditor';
import { SwipeRow } from '@/components/SwipeRow';
import { useStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { catEmoji, catLabel, entrySubtitle } from '@/lib/labels';
import { buildMoneyPlan } from '@engine';
import { addressWord, greeting } from '@/lib/profile';
import { loadMoneyProfile, planPulse, getGuardrail, monthlyBucketSpend } from '@/lib/moneyProfile';
import { fireNow } from '@/lib/nudge';
import { getBalance, setBalance, timeAgo, type Balance } from '@/lib/balance';
import { peekGap, greetedToday, markActive, markGreeted, getStreak } from '@/lib/streak';
import { AddSheet } from './AddEntry';
import { Settings } from './Settings';
import { buildBackup, needsBackup, saveBackup } from '@/lib/backup';

export function Home() {
  const t = useT();
  const store = useStore();
  const {
    profile, entries, todayPaise, budget, udhaar,
    pending, setRoute, updateEntry, removeEntry, restoreEntry, teachCategory, settleUdhaar,
  } = store;
  const [editing, setEditing] = useState<Entry | null>(null);
  const [bal, setBal] = useState<Balance | null>(() => getBalance());
  const [editBal, setEditBal] = useState(false);
  // coach greeting — gap markActive se pehle capture karo, warna 0 ho jayega
  const greetGapRef = useRef<number | null>(peekGap());
  const [showGreet, setShowGreet] = useState(() => !greetedToday());
  useEffect(() => { markActive(); }, []);
  const moneyProfile = useMemo(() => loadMoneyProfile(), []);
  const hasPlan = moneyProfile !== null;
  const plan = useMemo(() => (moneyProfile ? buildMoneyPlan(moneyProfile) : null), [moneyProfile]);
  const pulse = useMemo(() => (plan ? planPulse(plan, entries) : null), [plan, entries]);
  const bucketSpend = useMemo(() => monthlyBucketSpend(entries), [entries]);
  const topCut = useMemo(() => biggestDiscretionary(entries), [entries]);

  /* Fun budget cross ho gaya to ek baar (is mahine) notification — plan course-correct. */
  useEffect(() => {
    if (!pulse || pulse.overspentPaise <= 0) return;
    const now = new Date();
    const tag = `hisaabi-fun-alert-${now.getFullYear()}-${now.getMonth()}`;
    if (localStorage.getItem(tag)) return;
    localStorage.setItem(tag, '1');
    const strict = getGuardrail() === 'strict';
    void fireNow(
      strict ? 'Ruk ja — fun budget khatam' : 'Masti budget khatam',
      strict
        ? `Is mahine ka fun kharch ho gaya. Goal bachane ke liye ab sirf zaroori kharche.`
        : `Fun budget cross ho gaya — bache dinon me thoda dhyan, goal patri pe rahe.`,
    );
  }, [pulse]);

  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') ?? 'dark');
  const [showBackup, setShowBackup] = useState(() => needsBackup(store.entries.length));

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('hisaabi-theme', next);
    setTheme(next);
  }

  /** Poora hisaab chukta — us bande ki saari entries ek saath settle. */
  async function settleAll(ids: string[], name: string) {
    for (const id of ids) await settleUdhaar(id);
    toast.show(`${name} ka hisaab barabar ✅`);
  }

  async function takeBackup() {
    const res = await saveBackup(buildBackup({ profile, entries, trips: store.trips }));
    if (res !== 'failed') {
      setShowBackup(false);
      toast.show('Backup ho gaya ✅');
    }
  }

  /** Delete hamesha wapas laya ja sake — warna galti se swipe hone ka dar rehta hai. */
  async function deleteWithUndo(e: Entry) {
    await removeEntry(e.id);
    toast.show(t(`${e.title} removed`, `${e.title} hata di`), { label: t('Undo', 'Wapas lao'), run: () => void restoreEntry(e) });
  }

  async function quickAdd(line: string) {
    const parsed = await store.engine.ingestText(line, { source: 'manual' });
    if (!parsed.length) return;
    await store.commitDrafts(parsed);
    toast.show(t(`${parsed[0]!.title} · ${formatINR(parsed[0]!.amountPaise)} added`, `${parsed[0]!.title} · ${formatINR(parsed[0]!.amountPaise)} add ho gaya`));
  }
  const [sheet, setSheet] = useState<'type' | 'voice' | 'settings' | null>(null);
  const toast = useToast();

  const today = useMemo(() => {
    const { from, to } = dayRange(new Date());
    return entries.filter((e) => {
      const at = new Date(e.occurredAt).getTime();
      return at >= from.getTime() && at <= to.getTime();
    });
  }, [entries]);

  const lastEntry = useMemo(() => {
    let best: Entry | null = null;
    for (const e of entries) {
      if (e.status !== 'confirmed') continue;
      const w = new Date(e.updatedAt ?? e.createdAt).getTime();
      if (!best || w > new Date(best.updatedAt ?? best.createdAt).getTime()) best = e;
    }
    return best;
  }, [entries]);

  const recent = today.length ? today : entries.slice(0, 6);
  const spentRatio = profile
    ? Math.min(1, budget.spentThisMonthPaise / Math.max(1, profile.monthlyBudgetPaise))
    : 0;

  return (
    <div className="screen">
      <header className="home-top">
        <div className="grow">
          <div className="greet">{profile ? greeting(profile) : t('Hello', 'Namaste')}</div>
          <div className="name">{profile ? addressWord(profile) : t('friend', 'dost')}</div>
        </div>
        {pending.length > 0 && (
          <button className="icon-btn badge-btn" onClick={() => setRoute('review')} aria-label={t('Review inbox', 'Review inbox')}>
            {Icon.inbox}<span className="badge-dot num">{pending.length}</span>
          </button>
        )}
        <button className="icon-btn" onClick={() => setRoute('trips')} aria-label={t('Group expenses', 'Doston ka hisaab')}>
          {Icon.users}
        </button>
        <button className="icon-btn" onClick={toggleTheme} aria-label={t('Change theme', 'Theme badlo')}>
          {theme === 'light' ? Icon.moon : Icon.sun}
        </button>
        <button className="icon-btn" onClick={() => setSheet('settings')} aria-label={t('Settings', 'Settings')}>
          {Icon.settings}
        </button>
      </header>

      <div className="home-grid">
      <div>
      <div className="hero-card">
        <div className="k">{t("Today's spend", 'Aaj ka kharcha')}</div>
        <div className="big"><Amount paise={todayPaise} /></div>
        <div className="sub">
          {today.length
            ? t(`${today.length} ${today.length === 1 ? 'entry' : 'entries'} · ${formatINR(budget.spentThisMonthPaise)} this month`,
                `${today.length} ${today.length === 1 ? 'entry' : 'entries'} · is mahine ${formatINR(budget.spentThisMonthPaise)}`)
            : t('Nothing noted yet', 'Abhi tak kuch nahi likha')}
        </div>
        <div className="bar" data-tone={budget.status === 'over' ? 'bad' : undefined}>
          <i style={{ width: `${spentRatio * 100}%` }} />
        </div>
        {lastEntry && (
          <div className="hero-last">{t(`Last entry ${fmtWhen(lastEntry.updatedAt ?? lastEntry.createdAt)}`, `Aakhri entry ${fmtWhen(lastEntry.updatedAt ?? lastEntry.createdAt)}`)}</div>
        )}
      </div>

      {showGreet && (
        <CoachGreeting
          gap={greetGapRef.current}
          streak={getStreak()}
          onLog={() => { markGreeted(); setShowGreet(false); setSheet('type'); }}
          onLater={() => { markGreeted(); setShowGreet(false); }}
        />
      )}

      <button className="balance-card" onClick={() => setEditBal(true)}>
        <span className="grow">
          <span className="bc-k">💰 {t('Money in hand', 'Jeb me abhi')}</span>
          <span className="bc-sub">{bal ? t(`updated ${timeAgo(bal.updatedAt).en}`, `update ${timeAgo(bal.updatedAt).hi}`) : t('Tap to set your real balance', 'Apna asli balance set karo')}</span>
        </span>
        <span className="bc-v num">{bal ? formatINR(bal.paise) : '—'}</span>
        <span className="bc-edit">✎</span>
      </button>

      <MonthCard
        income={moneyProfile?.incomePaise ?? 0}
        spent={budget.spentThisMonthPaise}
        perDayPaise={budget.perDayPaise}
        overBudget={budget.status === 'over'}
        bucketSpend={bucketSpend}
        planNeeds={plan?.buckets.find((b) => b.id === 'needs')?.allocatedPaise ?? 0}
        planFun={plan?.buckets.find((b) => b.id === 'fun')?.allocatedPaise ?? 0}
        planSave={plan ? plan.buckets.filter((b) => b.id === 'emergency' || b.id === 'savings' || b.id === 'debt').reduce((s, b) => s + b.allocatedPaise, 0) : 0}
        topCut={topCut}
        onBreakdown={() => setRoute('history')}
      />

      <button className="plan-cta" data-alert={pulse && pulse.overspentPaise > 0 ? '' : undefined} onClick={() => setRoute('plan')}>
        <span className="pc-ico">{pulse && pulse.overspentPaise > 0 ? '⚠️' : '🎯'}</span>
        <span className="grow">
          {!hasPlan ? (
            <>
              <b>{t('Make a money plan', 'Ek paisa plan banao')}</b>
              <i>{t('Split your salary smartly — needs, savings, goal', 'Salary ko samajhdari se baato — zaroori, bachat, goal')}</i>
            </>
          ) : pulse && pulse.overspentPaise > 0 ? (
            <>
              <b>{t('Fun budget over', 'Masti budget khatam')}</b>
              <i>{t(`${formatINR(pulse.overspentPaise)} over — ease up so the goal stays on track`, `${formatINR(pulse.overspentPaise)} zyada — bache dinon me dhyan, goal patri pe rahe`)}</i>
            </>
          ) : (
            <>
              <b>{t(`Fun safe today: ${formatINR(pulse?.safePerDayPaise ?? 0)}`, `Aaj masti safe: ${formatINR(pulse?.safePerDayPaise ?? 0)}`)}</b>
              <i>{t(`${formatINR(pulse?.funLeftPaise ?? 0)} left for ${pulse?.daysLeft ?? 0} days · tap for full plan`, `${formatINR(pulse?.funLeftPaise ?? 0)} bacha ${pulse?.daysLeft ?? 0} din ke liye · poora plan dekho`)}</i>
            </>
          )}
        </span>
        <span className="pc-arrow">→</span>
      </button>

      {showBackup && (
        <div className="nudge-card">
          <span className="nudge-ico">💾</span>
          <span className="grow">
            <b>{t('Take a backup', 'Backup le lo')}</b>
            <i>{t(`${entries.length} entries are only on this phone. No sync yet — make a file and send it to yourself.`, `${entries.length} entries sirf is phone me hain. Sync abhi nahi hai — file bana ke khud ko bhej do.`)}</i>
          </span>
          <span className="nudge-acts">
            <button className="btn btn-primary btn-sm" onClick={() => void takeBackup()}>{t('Take', 'Lo')}</button>
            <button className="nudge-skip" onClick={() => setShowBackup(false)}>{t('Later', 'Baad me')}</button>
          </span>
        </div>
      )}

      {udhaar.people.length > 0 && (
        <div className="udhaar-card">
          <div className="udhaar-top">
            <span className="tile-k">{t('Money owed', 'Lena-dena')}</span>
            <span className="udhaar-net">
              {udhaar.toGetPaise > 0 && <b className="good">↓ {formatINR(udhaar.toGetPaise)} {t('to get', 'lene')}</b>}
              {udhaar.toGivePaise > 0 && <b className="bad">↑ {formatINR(udhaar.toGivePaise)} {t('to give', 'dene')}</b>}
            </span>
          </div>

          {udhaar.people.slice(0, 4).map((p) => (
            <div className="udhaar-row" key={p.name}>
              <span className="u-name">{p.name}</span>
              <span className="u-amt num" data-tone={p.netPaise > 0 ? 'good' : 'bad'}>
                {p.netPaise > 0 ? `${formatINR(p.netPaise)} ${t('to get', 'lene')}` : `${formatINR(-p.netPaise)} ${t('to give', 'dene')}`}
              </span>
              <button className="u-done" onClick={() => void settleAll(p.entries.map((e) => e.id), p.name)}>
                {t('Done', 'Ho gaya')}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="quick-row">
        <span className="quick-k">{t('Quick add', 'Jaldi se')}</span>
        {['chai 20', 'auto 60', 'sabzi 140', 'petrol 500'].map((q) => (
          <button key={q} className="quick" onClick={() => void quickAdd(q)}>+ {q}</button>
        ))}
      </div>
      </div>

      <div>
      <div className="section-title">
        <h2>{today.length ? t("Today's spends", 'Aaj ke kharche') : t('Recent spends', 'Pichhle kharche')}</h2>
        {entries.length > 0 && (
          <button className="see-all" onClick={() => setRoute('history')}>{t('See all →', 'Sab dekho →')}</button>
        )}
      </div>

      {recent.length === 0 ? (
        <EmptyState />
      ) : (
        <div>
          {recent.map((e, i) => {
            return (
              <SwipeRow key={e.id} onDelete={() => void deleteWithUndo(e)}>
              <button className="entry" data-type={e.type} style={{ animationDelay: `${i * 40}ms` }}
                      onClick={() => setEditing(e)}>
                <span className="e-ico" aria-hidden="true">{catEmoji(e.category ?? 'other')}</span>
                <span>
                  <span className="e-t">{e.title}</span>
                  <span className="e-s">
                    {entrySubtitle(e.type, e.category ?? 'other')}
                    {e.settledAt ? t(' · settled', ' · chukta') : ''}
                    {e.sourceApp ? ` · ${e.sourceApp}` : ''}
                  </span>
                </span>
                <span className="e-a num">
                  {e.type === 'income' || e.type === 'cash_in' || e.type === 'borrowed' || e.type === 'refund' ? '+' : ''}
                  {formatINR(e.amountPaise)}
                </span>
              </button>
              </SwipeRow>
            );
          })}
        </div>
      )}
      </div>
      </div>

      <nav className="dock">
        <div className="dock-bar">
          <button className="dock-spark" onClick={() => setSheet('type')} aria-label={t('Write or ask', 'Likho ya poocho')}>
            {Icon.spark}
          </button>
          <button className="dock-input" onClick={() => setSheet('type')}>
            {t('Note a spend or ask…', 'Kharcha likho ya poocho…')}
          </button>
        </div>
        <button className="mic-btn" onClick={() => setSheet('voice')} aria-label={t('Add by voice', 'Bol ke add karo')}>
          {Icon.mic}
        </button>
      </nav>

      {(sheet === 'type' || sheet === 'voice') && (
        <AddSheet
          mode={sheet}
          onClose={() => setSheet(null)}
          onSaved={(count, total) => {
            setSheet(null);
            toast.show(t(`${count} ${count === 1 ? 'entry' : 'entries'} added · ${formatINR(total)}`, `${count} ${count === 1 ? 'entry' : 'entries'} add ho gayi · ${formatINR(total)}`));
          }}
        />
      )}

      {editing && (
        <EntryEditor
          draft={editing}
          title={t('Fix the entry', 'Entry theek karo')}
          onClose={() => setEditing(null)}
          onDelete={() => { void removeEntry(editing.id); setEditing(null); toast.show(t('Entry removed', 'Entry hata di')); }}
          onSave={(next, changed) => {
            if (changed && next.category) void teachCategory(next.merchant ?? next.title, next.category);
            void updateEntry({ ...editing, ...next });
            setEditing(null);
            toast.show(t('Updated', 'Update ho gaya'));
          }}
        />
      )}

      {sheet === 'settings' && <Settings onClose={() => setSheet(null)} />}

      {editBal && (
        <Sheet onClose={() => setEditBal(false)}>
          <BalanceEditor
            initial={bal?.paise ?? 0}
            onSave={(p) => { setBal(setBalance(p)); setEditBal(false); toast.show(t('Balance updated ✅', 'Balance update ho gaya ✅')); }}
          />
        </Sheet>
      )}

      {toast.node}
    </div>
  );
}

/* Khaali screen pe ek hi line hamesha dikhna bore karta hai —
   isliye har kuch second baad naya ishara. */
const EMPTY_LINES: Array<{ icon: string; en: string; hi: string }> = [
  { icon: '🎤', en: 'Tap the mic and say it — "chai bees, auto saath"', hi: 'Mic dabao aur bol do — “chai bees, auto saath”' },
  { icon: '✍️', en: 'Or type it — "sabzi ek sau chalis"', hi: 'Ya likh do — “sabzi ek sau chalis”' },
  { icon: '⚡', en: 'You can even say five spends at once', hi: 'Ek saath paanch kharche bhi bol sakte ho' },
  { icon: '🌙', en: 'At 9 PM you get the whole day in one line', hi: 'Raat 9 baje ek line me poora hisaab milega' },
  { icon: '🔒', en: 'Everything stays on your phone', hi: 'Sab kuch tumhare phone me hi rehta hai' },
  { icon: '📴', en: 'Works fully without internet', hi: 'Bina internet ke bhi poora chalta hai' },
];

/* ---------- month analytics (clear table: aaya / kharch / bachat) ---------- */

function MonthCard({ income, spent, perDayPaise, overBudget, bucketSpend, planNeeds, planFun, planSave, topCut, onBreakdown }: {
  income: number; spent: number; perDayPaise: number; overBudget: boolean;
  bucketSpend: { needs: number; fun: number; other: number };
  planNeeds: number; planFun: number; planSave: number;
  topCut: { category: CategoryId; paise: number } | null;
  onBreakdown(): void;
}) {
  const t = useT();
  const leftToSave = Math.max(0, income - spent);
  const hasPlan = income > 0;
  return (
    <div className="month-card">
      <div className="mc-title">{t('This month', 'Is mahine')} <small>{t(`safe ~${formatINR(perDayPaise)}/day`, `safe ~${formatINR(perDayPaise)}/din`)}</small></div>

      <div className="mc-head">
        <div className="mc-cell"><span className="mc-k">{t('Came in', 'Aaya')}</span><b className="num">{hasPlan ? formatINR(income) : '—'}</b></div>
        <div className="mc-cell" data-tone={overBudget ? 'bad' : undefined}><span className="mc-k">{t('Spent', 'Kharch')}</span><b className="num">{formatINR(spent)}</b></div>
        <div className="mc-cell"><span className="mc-k">{t('To save', 'Bachat')}</span><b className="num good">{hasPlan ? formatINR(leftToSave) : '—'}</b></div>
      </div>

      <div className="mc-sec">{t('Where it went', 'Kahan gaya')}</div>
      <MRow emoji="🏠" label={t('Needs', 'Zaroori')} spent={bucketSpend.needs} planned={planNeeds} />
      <MRow emoji="🎉" label={t('Fun', 'Masti')} spent={bucketSpend.fun} planned={planFun} />
      {bucketSpend.other > 0 && <MRow emoji="📦" label={t('Other', 'Aur')} spent={bucketSpend.other} planned={0} />}

      {planSave > 0 && (
        <>
          <div className="mc-sec">{t('Set aside for savings', 'Bachat ke liye')}</div>
          <MRow emoji="🛟" label={t('Emergency + invest', 'Emergency + invest')} spent={0} planned={planSave} savingRow />
        </>
      )}

      {topCut && topCut.paise > 0 && (
        <div className="save-tip">
          <span className="st-ico">💡</span>
          <div className="grow">
            <b>{t('Where you can save', 'Bachat kahan se')}</b>
            <p>{t(
              `Most flexible spend is on ${catLabel(topCut.category)} (${formatINR(topCut.paise)}). Trim it ~20% → about ${formatINR(Math.round(topCut.paise * 0.2))} back to savings.`,
              `Sabse zyada flexible kharcha ${catLabel(topCut.category)} me (${formatINR(topCut.paise)}). ~20% ghatao → lagbhag ${formatINR(Math.round(topCut.paise * 0.2))} bachat me.`,
            )}</p>
          </div>
        </div>
      )}

      <button className="mc-more" onClick={onBreakdown}>{t('Full breakdown →', 'Poora hisaab →')}</button>
    </div>
  );
}

function MRow({ emoji, label, spent, planned, savingRow }: { emoji: string; label: string; spent: number; planned: number; savingRow?: boolean }) {
  const pct = planned > 0 ? Math.min(100, (spent / planned) * 100) : (spent > 0 ? 100 : 0);
  const over = planned > 0 && spent > planned;
  return (
    <div className="mrow">
      <span className="mr-label">{emoji} {label}</span>
      <span className="mr-bar"><i style={{ width: `${pct}%` }} data-tone={over ? 'bad' : undefined} /></span>
      <span className="mr-amt num">
        {savingRow ? formatINR(planned) : planned > 0 ? `${formatINR(spent)} / ${formatINR(planned)}` : formatINR(spent)}
      </span>
    </div>
  );
}

function biggestDiscretionary(entries: Entry[]): { category: CategoryId; paise: number } | null {
  const { from, to } = monthRange(new Date());
  const disc = new Set<CategoryId>(['food', 'fun', 'shopping']);
  const by = new Map<CategoryId, number>();
  for (const e of entries) {
    if (e.status !== 'confirmed' || e.type !== 'expense') continue;
    const at = new Date(e.occurredAt).getTime();
    if (at < from.getTime() || at > to.getTime()) continue;
    const c = (e.category ?? 'other') as CategoryId;
    if (!disc.has(c)) continue;
    by.set(c, (by.get(c) ?? 0) + e.amountPaise);
  }
  let top: { category: CategoryId; paise: number } | null = null;
  for (const [category, paise] of by) if (!top || paise > top.paise) top = { category, paise };
  return top;
}

/* ---------- coach greeting (mood: welcome → naraz, streak ke hisaab se) ---------- */

function CoachGreeting({ gap, streak, onLog, onLater }: { gap: number | null; streak: number; onLog(): void; onLater(): void }) {
  const t = useT();

  // gap = pichhli visit se kitne din. null = naya user.
  let mood: 'new' | 'happy' | 'gentle' | 'firm' | 'angry';
  if (gap === null) mood = 'new';
  else if (gap <= 1) mood = 'happy';
  else if (gap <= 4) mood = 'gentle';
  else if (gap <= 9) mood = 'firm';
  else mood = 'angry';

  const FACE = { new: '🦉', happy: '🦉', gentle: '🦉', firm: '🦉', angry: '😤' }[mood];

  const copy: Record<typeof mood, { title: [string, string]; body: [string, string] }> = {
    new: {
      title: ["Let's start! 🦉", 'Chalo shuru karein! 🦉'],
      body: ['I\'m your money coach. Tell me what you\'ve spent so far today.', 'Main tumhara paisa-coach. Batao aaj ab tak kya kharch kiya.'],
    },
    happy: {
      title: [`Welcome back! 🔥 ${streak}-day streak`, `Wapas aa gaye! 🔥 ${streak} din se`],
      body: ["Let's log today's spends — what did you buy?", 'Chalo aaj ka hisaab kar lein — kya-kya liya?'],
    },
    gentle: {
      title: [`Back after ${gap} days`, `${gap} din baad aaye`],
      body: ['No worries — let\'s catch up. What did you spend?', 'Koi baat nahi — abhi pakad lete hai. Kya kharch hua?'],
    },
    firm: {
      title: [`It's been ${gap} days`, `${gap} din ho gaye`],
      body: ['Remember your goal? A day or two off and the picture blurs. Let\'s log it.', 'Goal yaad hai na? Ek-do din chhodo aur hisaab dhundhla. Chalo note karte hai.'],
    },
    angry: {
      title: [`${gap} days gone?! 😤`, `${gap} din gayab?! 😤`],
      body: ["Doesn't look like you're serious about your goal. Here now? Then finish it — log your spends.", 'Lagta hai goal ke liye serious nahi ho. Aaye ho to poora karo — hisaab likho.'],
    },
  };

  const c = copy[mood];
  return (
    <div className={`coach-greet mood-${mood}`}>
      <span className="cg-face">{FACE}</span>
      <div className="grow">
        <b>{t(...c.title)}</b>
        <p>{t(...c.body)}</p>
        <div className="cg-acts">
          <button className="btn btn-primary btn-sm" onClick={onLog}>{t("Let's log →", 'Chalo, hisaab →')}</button>
          <button className="cg-later" onClick={onLater}>{t('Not now', 'Abhi nahi')}</button>
        </div>
      </div>
    </div>
  );
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "3:28pm · 12 Aug" — kab dali entry. */
function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const hh = d.getHours();
  const h12 = ((hh + 11) % 12) + 1;
  const ap = hh < 12 ? 'am' : 'pm';
  return `${h12}:${String(d.getMinutes()).padStart(2, '0')}${ap} · ${d.getDate()} ${MON[d.getMonth()]}`;
}

/* ---------- balance editor (low-friction: slider + quick add) ---------- */

function BalanceEditor({ initial, onSave }: { initial: number; onSave(paise: number): void }) {
  const t = useT();
  const [v, setV] = useState(toRupees(initial));   // rupees
  const max = 500000;
  const pct = (Math.min(v, max) / max) * 100;
  return (
    <div className="balance-editor">
      <h3>{t('Money in hand right now', 'Abhi jeb me kitna')}</h3>
      <div className="be-val num">{formatINR(toPaise(v))}</div>
      <div className="slider-wrap">
        <button className="step-b" onClick={() => setV(Math.max(0, v - 500))} aria-label="−">−</button>
        <input className="slider" type="range" min={0} max={max} step={500} value={Math.min(v, max)}
               style={{ ['--pct' as string]: `${pct}%` }} onChange={(e) => setV(Number(e.target.value))} />
        <button className="step-b" onClick={() => setV(v + 500)} aria-label="+">+</button>
      </div>
      <div className="be-quick">
        {[100, 500, 1000, 2000].map((q) => (
          <button key={q} className="chip" onClick={() => setV(v + q)}>+{q}</button>
        ))}
      </div>
      <button className="btn btn-primary btn-block" onClick={() => onSave(toPaise(v))}>{t('Save', 'Save karo')}</button>
    </div>
  );
}

function EmptyState() {
  const t = useT();
  const [i, setI] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setI((n) => (n + 1) % EMPTY_LINES.length), 3600);
    return () => clearInterval(timer);
  }, []);

  const line = EMPTY_LINES[i]!;

  return (
    <div className="empty">
      <div className="empty-rotate" key={i}>
        <div className="big">{line.icon}</div>
        <p>{t(line.en, line.hi)}</p>
      </div>
      <div className="empty-dots" aria-hidden="true">
        {EMPTY_LINES.map((_, n) => <i key={n} data-on={n === i} />)}
      </div>
    </div>
  );
}

export { Sheet };
