import { useMemo, useState } from 'react';
import {
  buildPlan, categoryMeta, formatINR, formatShort, monthRange,
  type CategoryId, type Entry,
} from '@engine';
import { Icon, useToast } from '@/components/ui';
import { EntryEditor } from '@/components/EntryEditor';
import { useStore } from '@/lib/store';

/**
 * Poora hisaab — mahine ka.
 *
 * Iske bina entry daalne ka koi phal nahi milta: user hafta bhar likhta hai,
 * phir dekhna chahta hai "kahan gaya?" aur koi rasta hi nahi hota.
 * Yahan teen sawaal ka jawab hai: kitna, kis pe, aur kis din.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function History() {
  const { entries, profile, setRoute, updateEntry, removeEntry, teachCategory } = useStore();
  const [offset, setOffset] = useState(0);          // 0 = is mahine, 1 = pichhla…
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const toast = useToast();

  const when = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - offset);
    return d;
  }, [offset]);

  const plan = useMemo(
    () => buildPlan({
      entries,
      monthlyBudgetPaise: profile?.monthlyBudgetPaise ?? 0,
      now: offset === 0 ? new Date() : new Date(when.getFullYear(), when.getMonth() + 1, 0),
    }),
    [entries, profile, when, offset],
  );

  /** Us mahine ke kharche, category filter ke saath. */
  const list = useMemo(() => {
    const { from, to } = monthRange(when);
    return entries
      .filter((e) => {
        if (e.status !== 'confirmed' || e.type !== 'expense') return false;
        if (category && (e.category ?? 'other') !== category) return false;
        const at = new Date(e.occurredAt).getTime();
        return at >= from.getTime() && at <= to.getTime();
      })
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }, [entries, when, category]);

  const total = list.reduce((s, e) => s + e.amountPaise, 0);

  /** Din ke hisaab se group — timeline banane ke liye. */
  const byDay = useMemo(() => {
    const map = new Map<string, { date: Date; paise: number; entries: Entry[] }>();
    for (const e of list) {
      // LOCAL din se group karo. ISO string UTC hoti hai — raat ke kharche
      // agle UTC din me chale jate the aur ek hi din do baar dikhta tha.
      const d = new Date(e.occurredAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const row = map.get(key) ?? { date: d, paise: 0, entries: [] };
      row.paise += e.amountPaise;
      row.entries.push(e);
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [list]);

  const busiest = byDay.reduce((m, d) => Math.max(m, d.paise), 0);
  const monthName = `${MONTHS[when.getMonth()]} ${when.getFullYear()}`;

  return (
    <div className="screen">
      <header className="home-top">
        <button className="icon-btn" onClick={() => setRoute('home')} aria-label="Peeche">{Icon.back}</button>
        <div className="grow" style={{ marginLeft: 4 }}>
          <div className="greet">Poora hisaab</div>
          <div className="name">{monthName}</div>
        </div>
        <button className="icon-btn" onClick={() => setOffset((o) => o + 1)} aria-label="Pichhla mahina">
          {Icon.back}
        </button>
        <button className="icon-btn" disabled={offset === 0} style={{ opacity: offset === 0 ? .35 : 1 }}
                onClick={() => setOffset((o) => Math.max(0, o - 1))} aria-label="Agla mahina">
          <span style={{ transform: 'rotate(180deg)', display: 'grid' }}>{Icon.back}</span>
        </button>
      </header>

      {list.length === 0 ? (
        <div className="empty">
          <div className="big">📭</div>
          <p>{monthName} me koi kharcha nahi mila.</p>
        </div>
      ) : (
        <>
          <div className="hero-card">
            <div className="k">{category ? categoryMeta(category).label : 'Kul kharcha'}</div>
            <div className="big num">{formatINR(total)}</div>
            <div className="sub">
              {list.length} {list.length === 1 ? 'kharcha' : 'kharche'}
              {offset === 0 && plan.burnPerDayPaise > 0 &&
                ` · rozana ${formatINR(Math.round(plan.burnPerDayPaise / 100) * 100)}`}
            </div>
            {offset === 0 && plan.projectedOverPaise > 0 && (
              <div className="hist-warn">
                Isi raftaar se mahina ₹{Math.round(plan.projectedMonthEndPaise / 100).toLocaleString('en-IN')} pe khatam hoga —
                budget se {formatINR(plan.projectedOverPaise)} zyada.
              </div>
            )}
            {offset === 0 && plan.runOutDay && plan.projectedOverPaise > 0 && (
              <div className="hist-warn">Isi hisaab se {plan.runOutDay} tarikh ko paisa khatam.</div>
            )}
          </div>

          {/* kis pe gaya */}
          <div className="section-title">
            <h2>Kis pe gaya</h2>
            {category && <button className="chip-clear" onClick={() => setCategory(null)}>× filter hatao</button>}
          </div>

          <div className="cat-bars">
            {plan.topCategories.map((c, i) => (
              <button key={c.id} className="cat-bar" data-on={category === c.id}
                      style={{ animationDelay: `${i * 50}ms` }}
                      onClick={() => setCategory(category === c.id ? null : c.id)}>
                <span className="cb-top">
                  <span className="cb-name">{c.emoji} {c.label}</span>
                  <span className="cb-amt num">{formatINR(c.paise)}</span>
                </span>
                <span className="cb-track"><i style={{ width: `${Math.round(c.share * 100)}%` }} /></span>
                <span className="cb-foot">
                  {Math.round(c.share * 100)}% · {c.count} {c.count === 1 ? 'baar' : 'baar'}
                  {c.lastMonthPaise > 0 && (
                    <b data-tone={c.paise > c.lastMonthPaise ? 'up' : 'down'}>
                      {c.paise > c.lastMonthPaise ? '↑' : '↓'} {formatShort(Math.abs(c.paise - c.lastMonthPaise))}
                    </b>
                  )}
                </span>
              </button>
            ))}
          </div>

          {/* kis din */}
          <div className="section-title"><h2>Kis din</h2></div>
          <div className="day-list">
            {byDay.map((d, i) => (
              <div className="day" key={d.date.toISOString()} style={{ animationDelay: `${i * 35}ms` }}>
                <div className="day-head">
                  <span className="day-when">
                    {d.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })}
                  </span>
                  <span className="day-bar"><i style={{ width: `${busiest ? (d.paise / busiest) * 100 : 0}%` }} /></span>
                  <span className="day-amt num">{formatINR(d.paise)}</span>
                </div>

                {d.entries.map((e) => {
                  const meta = categoryMeta(e.category ?? 'other');
                  return (
                    <button className="day-entry" key={e.id} onClick={() => setEditing(e)}>
                      <span className="de-ico">{meta.emoji}</span>
                      <span className="de-name">{e.merchant ?? e.title}</span>
                      <span className="de-amt num">{formatINR(e.amountPaise)}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
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

      {toast.node}
    </div>
  );
}
