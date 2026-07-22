import { useMemo, useState } from 'react';
import { categoryMeta, dayRange, formatINR, type Entry } from '@engine';
import { Amount, Icon, Sheet, useToast } from '@/components/ui';
import { EntryEditor } from '@/components/EntryEditor';
import { useStore } from '@/lib/store';
import { addressWord, greeting } from '@/lib/profile';
import { AddSheet } from './AddEntry';
import { AskSheet } from './Ask';
import { Settings } from './Settings';

export function Home() {
  const store = useStore();
  const {
    profile, entries, todayPaise, budget, cashPaise,
    pending, setRoute, updateEntry, removeEntry, teachCategory,
  } = store;
  const [editing, setEditing] = useState<Entry | null>(null);
  const [sheet, setSheet] = useState<'type' | 'voice' | 'ask' | 'settings' | null>(null);
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
            📥<span className="badge-dot num">{pending.length}</span>
          </button>
        )}
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
        <div className="stat" style={{ animationDelay: '160ms' }}>
          <div className="k">Is mahine</div>
          <div className="v num">{formatINR(budget.spentThisMonthPaise)}</div>
        </div>
      </div>
      </div>

      <div>
      <div className="section-title">
        <h2>{today.length ? 'Aaj ke kharche' : 'Pichhle kharche'}</h2>
        {entries.length > 0 && <span>{entries.length} total</span>}
      </div>

      {recent.length === 0 ? (
        <div className="empty">
          <div className="big">🎤</div>
          Mic dabao aur bol do — <br />“chai bees, auto saath”
        </div>
      ) : (
        <div>
          {recent.map((e, i) => {
            const meta = categoryMeta(e.category ?? 'other');
            return (
              <button className="entry" key={e.id} data-type={e.type} style={{ animationDelay: `${i * 40}ms` }}
                      onClick={() => setEditing(e)}>
                <span className="e-ico" aria-hidden="true">{meta.emoji}</span>
                <span>
                  <span className="e-t">{e.title}</span>
                  <span className="e-s">
                    {meta.label}
                    {e.sourceApp ? ` · ${e.sourceApp}` : e.paidWith === 'cash' ? ' · cash' : ''}
                  </span>
                </span>
                <span className="e-a num">
                  {e.type === 'expense' ? '' : '+'}{formatINR(e.amountPaise)}
                </span>
              </button>
            );
          })}
        </div>
      )}
      </div>
      </div>

      <nav className="dock">
        <button className="ask" onClick={() => setSheet('ask')}>
          {Icon.spark} Poocho: is mahine kitna gaya?
        </button>
        <button className="icon-btn" onClick={() => setSheet('type')} aria-label="Likh ke add karo">
          {Icon.plus}
        </button>
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

      {sheet === 'ask' && <AskSheet onClose={() => setSheet(null)} />}
      {sheet === 'settings' && <Settings onClose={() => setSheet(null)} />}

      {toast.node}
    </div>
  );
}

export { Sheet };
