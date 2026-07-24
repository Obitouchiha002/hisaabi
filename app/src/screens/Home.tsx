import { useEffect, useMemo, useState } from 'react';
import { dayRange, formatINR, type Entry } from '@engine';
import { Amount, Icon, Sheet, useToast } from '@/components/ui';
import { EntryEditor } from '@/components/EntryEditor';
import { SwipeRow } from '@/components/SwipeRow';
import { useStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { catEmoji, entrySubtitle } from '@/lib/labels';
import { addressWord, greeting } from '@/lib/profile';
import { AddSheet } from './AddEntry';
import { Settings } from './Settings';
import { buildBackup, needsBackup, saveBackup } from '@/lib/backup';

export function Home() {
  const t = useT();
  const store = useStore();
  const {
    profile, entries, todayPaise, budget, cashPaise, udhaar,
    pending, setRoute, updateEntry, removeEntry, restoreEntry, teachCategory, settleUdhaar,
  } = store;
  const [editing, setEditing] = useState<Entry | null>(null);
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
      </div>

      <div className="stat-row">
        <div className="stat" data-tone={budget.status === 'over' ? 'bad' : budget.status === 'tight' ? 'warn' : undefined}
             style={{ animationDelay: '60ms' }}>
          <div className="k">{t('Safe today', 'Aaj safe hai')}</div>
          <div className="v num">
            {formatINR(budget.perDayPaise)}<small> {t('/day', '/din')}</small>
          </div>
        </div>
        <div className="stat" style={{ animationDelay: '110ms' }}>
          <div className="k">{cashPaise !== 0 ? t('Cash left', 'Cash bacha') : t('Left this month', 'Mahine me bacha')}</div>
          <div className="v num">
            {formatINR(cashPaise !== 0 ? cashPaise : Math.max(0, budget.leftPaise))}
          </div>
        </div>
        <button className="stat stat-tap" style={{ animationDelay: '160ms' }} onClick={() => setRoute('history')}>
          <div className="k">{t('This month', 'Is mahine')}</div>
          <div className="v num">{formatINR(budget.spentThisMonthPaise)}</div>
          <div className="stat-more">{t('Full breakdown →', 'Poora hisaab →')}</div>
        </button>
      </div>

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
                  {e.type === 'income' || e.type === 'cash_in' || e.type === 'borrowed' ? '+' : ''}
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
