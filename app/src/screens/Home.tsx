import { useEffect, useMemo, useState } from 'react';
import { categoryMeta, dayRange, formatINR, type Entry } from '@engine';
import { Amount, Icon, Sheet, useToast } from '@/components/ui';
import { EntryEditor } from '@/components/EntryEditor';
import { SwipeRow } from '@/components/SwipeRow';
import { useStore } from '@/lib/store';
import { addressWord, greeting } from '@/lib/profile';
import { AddSheet } from './AddEntry';
import { Settings } from './Settings';
import { buildBackup, needsBackup, saveBackup } from '@/lib/backup';

export function Home() {
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
    toast.show(`${e.title} hata di`, { label: 'Wapas lao', run: () => void restoreEntry(e) });
  }

  async function quickAdd(line: string) {
    const parsed = await store.engine.ingestText(line, { source: 'manual' });
    if (!parsed.length) return;
    await store.commitDrafts(parsed);
    toast.show(`${parsed[0]!.title} · ${formatINR(parsed[0]!.amountPaise)} add ho gaya`);
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
          <div className="greet">{profile ? greeting(profile) : 'Namaste'}</div>
          <div className="name">{profile ? addressWord(profile) : 'dost'}</div>
        </div>
        {pending.length > 0 && (
          <button className="icon-btn badge-btn" onClick={() => setRoute('review')} aria-label="Review inbox">
            {Icon.inbox}<span className="badge-dot num">{pending.length}</span>
          </button>
        )}
        <button className="icon-btn" onClick={() => setRoute('trips')} aria-label="Doston ka hisaab">
          {Icon.users}
        </button>
        <button className="icon-btn" onClick={toggleTheme} aria-label="Theme badlo">
          {theme === 'light' ? Icon.moon : Icon.sun}
        </button>
        <button className="icon-btn" onClick={() => setSheet('settings')} aria-label="Settings">
          {Icon.settings}
        </button>
      </header>

      <div className="home-grid">
      <div>
      <div className="hero-card">
        <div className="k">Aaj ka kharcha</div>
        <div className="big"><Amount paise={todayPaise} /></div>
        <div className="sub">
          {today.length
            ? `${today.length} ${today.length === 1 ? 'entry' : 'entries'} · is mahine ${formatINR(budget.spentThisMonthPaise)}`
            : 'Abhi tak kuch nahi likha'}
        </div>
        <div className="bar" data-tone={budget.status === 'over' ? 'bad' : undefined}>
          <i style={{ width: `${spentRatio * 100}%` }} />
        </div>
      </div>

      <div className="stat-row">
        <div className="stat" data-tone={budget.status === 'over' ? 'bad' : budget.status === 'tight' ? 'warn' : undefined}
             style={{ animationDelay: '60ms' }}>
          <div className="k">Aaj safe hai</div>
          <div className="v num">
            {formatINR(budget.perDayPaise)}<small> /din</small>
          </div>
        </div>
        <div className="stat" style={{ animationDelay: '110ms' }}>
          <div className="k">{cashPaise !== 0 ? 'Cash bacha' : 'Mahine me bacha'}</div>
          <div className="v num">
            {formatINR(cashPaise !== 0 ? cashPaise : Math.max(0, budget.leftPaise))}
          </div>
        </div>
        <button className="stat stat-tap" style={{ animationDelay: '160ms' }} onClick={() => setRoute('history')}>
          <div className="k">Is mahine</div>
          <div className="v num">{formatINR(budget.spentThisMonthPaise)}</div>
          <div className="stat-more">Poora hisaab →</div>
        </button>
      </div>

      {showBackup && (
        <div className="nudge-card">
          <span className="nudge-ico">💾</span>
          <span className="grow">
            <b>Backup le lo</b>
            <i>{entries.length} entries sirf is phone me hain. Sync abhi nahi hai — file bana ke khud ko bhej do.</i>
          </span>
          <span className="nudge-acts">
            <button className="btn btn-primary btn-sm" onClick={() => void takeBackup()}>Lo</button>
            <button className="nudge-skip" onClick={() => setShowBackup(false)}>Baad me</button>
          </span>
        </div>
      )}

      {udhaar.people.length > 0 && (
        <div className="udhaar-card">
          <div className="udhaar-top">
            <span className="tile-k">Lena-dena</span>
            <span className="udhaar-net">
              {udhaar.toGetPaise > 0 && <b className="good">↓ {formatINR(udhaar.toGetPaise)} lene</b>}
              {udhaar.toGivePaise > 0 && <b className="bad">↑ {formatINR(udhaar.toGivePaise)} dene</b>}
            </span>
          </div>

          {udhaar.people.slice(0, 4).map((p) => (
            <div className="udhaar-row" key={p.name}>
              <span className="u-name">{p.name}</span>
              <span className="u-amt num" data-tone={p.netPaise > 0 ? 'good' : 'bad'}>
                {p.netPaise > 0 ? `${formatINR(p.netPaise)} lene` : `${formatINR(-p.netPaise)} dene`}
              </span>
              <button className="u-done" onClick={() => void settleAll(p.entries.map((e) => e.id), p.name)}>
                Ho gaya
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="quick-row">
        <span className="quick-k">Jaldi se</span>
        {['chai 20', 'auto 60', 'sabzi 140', 'petrol 500'].map((q) => (
          <button key={q} className="quick" onClick={() => void quickAdd(q)}>+ {q}</button>
        ))}
      </div>
      </div>

      <div>
      <div className="section-title">
        <h2>{today.length ? 'Aaj ke kharche' : 'Pichhle kharche'}</h2>
        {entries.length > 0 && (
          <button className="see-all" onClick={() => setRoute('history')}>Sab dekho →</button>
        )}
      </div>

      {recent.length === 0 ? (
        <EmptyState />
      ) : (
        <div>
          {recent.map((e, i) => {
            const meta = categoryMeta(e.category ?? 'other');
            return (
              <SwipeRow key={e.id} onDelete={() => void deleteWithUndo(e)}>
              <button className="entry" data-type={e.type} style={{ animationDelay: `${i * 40}ms` }}
                      onClick={() => setEditing(e)}>
                <span className="e-ico" aria-hidden="true">{meta.emoji}</span>
                <span>
                  <span className="e-t">{e.title}</span>
                  <span className="e-s">
                    {e.type === 'lent' ? 'Lena hai'
                      : e.type === 'borrowed' ? 'Dena hai'
                      : e.type === 'cash_in' ? 'Cash nikala'
                      : e.type === 'income' ? 'Aamdani'
                      : meta.label}
                    {e.settledAt ? ' · chukta' : ''}
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
          <button className="dock-spark" onClick={() => setSheet('type')} aria-label="Likho ya poocho">
            {Icon.spark}
          </button>
          <button className="dock-input" onClick={() => setSheet('type')}>
            Kharcha likho ya poocho…
          </button>
        </div>
        <button className="mic-btn" onClick={() => setSheet('voice')} aria-label="Bol ke add karo">
          {Icon.mic}
        </button>
      </nav>

      {(sheet === 'type' || sheet === 'voice') && (
        <AddSheet
          mode={sheet}
          onClose={() => setSheet(null)}
          onSaved={(count, total) => {
            setSheet(null);
            toast.show(`${count} ${count === 1 ? 'entry' : 'entries'} add ho gayi · ${formatINR(total)}`);
          }}
        />
      )}

      {editing && (
        <EntryEditor
          draft={editing}
          title="Entry theek karo"
          onClose={() => setEditing(null)}
          onDelete={() => { void removeEntry(editing.id); setEditing(null); toast.show('Entry hata di'); }}
          onSave={(next, changed) => {
            if (changed && next.category) void teachCategory(next.merchant ?? next.title, next.category);
            void updateEntry({ ...editing, ...next });
            setEditing(null);
            toast.show('Update ho gaya');
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
const EMPTY_LINES = [
  { icon: '🎤', text: 'Mic dabao aur bol do — “chai bees, auto saath”' },
  { icon: '✍️', text: 'Ya likh do — “sabzi ek sau chalis”' },
  { icon: '⚡', text: 'Ek saath paanch kharche bhi bol sakte ho' },
  { icon: '🌙', text: 'Raat 9 baje ek line me poora hisaab milega' },
  { icon: '🔒', text: 'Sab kuch tumhare phone me hi rehta hai' },
  { icon: '📴', text: 'Bina internet ke bhi poora chalta hai' },
];

function EmptyState() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % EMPTY_LINES.length), 3600);
    return () => clearInterval(t);
  }, []);

  const line = EMPTY_LINES[i]!;

  return (
    <div className="empty">
      <div className="empty-rotate" key={i}>
        <div className="big">{line.icon}</div>
        <p>{line.text}</p>
      </div>
      <div className="empty-dots" aria-hidden="true">
        {EMPTY_LINES.map((_, n) => <i key={n} data-on={n === i} />)}
      </div>
    </div>
  );
}

export { Sheet };
