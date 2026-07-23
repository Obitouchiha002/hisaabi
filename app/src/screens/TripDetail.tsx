import { useMemo, useState } from 'react';
import {
  categoryMeta, formatINR, resolveCategory, toPaise, tripAwards, tripShareText, tripSummary,
  type SplitMode, type Trip, type TripExpense,
} from '@engine';
import { Icon, Sheet, useToast } from '@/components/ui';
import { useStore } from '@/lib/store';
import { newId } from '@/lib/db';

/**
 * Ek trip ke andar — kharche, kaun kisko kitna de, aur khitab.
 * Poora hisaab engine se aata hai; ye screen sirf dikhati hai.
 */

export function TripDetail() {
  const { trips, openTripId, openTrip, addTripExpense, removeTripExpense, saveTrip, deleteTrip } = useStore();
  const trip = trips.find((t) => t.id === openTripId);
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<'kharche' | 'hisaab'>('kharche');
  const toast = useToast();

  const summary = useMemo(() => (trip ? tripSummary(trip) : null), [trip]);
  const awards = useMemo(() => (trip ? tripAwards(trip) : []), [trip]);

  if (!trip || !summary) {
    return (
      <div className="screen">
        <div className="empty"><div className="big">🤔</div><p>Trip nahi mila</p></div>
        <div className="q-foot"><button className="btn btn-ghost btn-block" onClick={() => openTrip(null)}>Wapas</button></div>
      </div>
    );
  }

  const budgetUsed = trip.budgetPaise ? Math.min(1, summary.totalPaise / trip.budgetPaise) : 0;
  const overBudget = trip.budgetPaise ? summary.totalPaise > trip.budgetPaise : false;

  async function share() {
    const text = tripShareText(trip!);
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast.show('Copy ho gaya — WhatsApp me paste karo'); }
    } catch { /* user ne cancel kiya */ }
  }

  return (
    <div className="screen">
      <header className="home-top">
        <button className="icon-btn" onClick={() => openTrip(null)} aria-label="Peeche">{Icon.back}</button>
        <div className="grow" style={{ marginLeft: 4 }}>
          <div className="greet">{trip.members.map((m) => m.name).join(', ')}</div>
          <div className="name">{trip.emoji} {trip.name}</div>
        </div>
        <button className="icon-btn" onClick={() => void share()} aria-label="Share">{Icon.share}</button>
      </header>

      {/* trip meter */}
      <div className="hero-card">
        <div className="k">Kul kharcha</div>
        <div className="big num">{formatINR(summary.totalPaise)}</div>
        <div className="sub">
          {summary.expenseCount} kharche · har banda {formatINR(summary.perHeadPaise)}
        </div>
        {trip.budgetPaise ? (
          <>
            <div className="bar" data-tone={overBudget ? 'bad' : undefined}>
              <i style={{ width: `${budgetUsed * 100}%` }} />
            </div>
            <div className="safe-legend" style={{ marginTop: 8 }}>
              <span>{formatINR(trip.budgetPaise)} ka budget</span>
              <span>{overBudget ? `${formatINR(summary.totalPaise - trip.budgetPaise)} zyada` : `${formatINR(trip.budgetPaise - summary.totalPaise)} bacha`}</span>
            </div>
          </>
        ) : (
          <button className="chip" style={{ marginTop: 12 }}
                  onClick={() => {
                    const val = prompt('Trip ka budget (₹)?');
                    const num = Number(val);
                    if (num > 0) void saveTrip({ ...trip, budgetPaise: toPaise(num) });
                  }}>
            + Budget set karo
          </button>
        )}
      </div>

      <div className="seg" style={{ marginTop: 16 }}>
        <button data-on={tab === 'kharche'} onClick={() => setTab('kharche')}>Kharche</button>
        <button data-on={tab === 'hisaab'} onClick={() => setTab('hisaab')}>Hisaab</button>
      </div>

      {tab === 'kharche' ? (
        trip.expenses.length === 0 ? (
          <div className="empty"><div className="big">🧾</div><p>Abhi koi kharcha nahi. Neeche se add karo.</p></div>
        ) : (
          <div className="trip-exp-list">
            {[...trip.expenses].reverse().map((e) => {
              const meta = categoryMeta(e.category ?? 'other');
              const payer = trip.members.find((m) => m.id === e.paidBy);
              return (
                <div className="entry" key={e.id} onClick={() => { if (confirm(`"${e.title}" hata dein?`)) void removeTripExpense(trip.id, e.id); }}>
                  <span className="e-ico" aria-hidden="true">{meta.emoji}</span>
                  <span>
                    <span className="e-t">{e.title}</span>
                    <span className="e-s">
                      {payer?.name ?? '?'} ne diya · {e.splitMode === 'equal' ? 'sabme barabar' : e.splitMode === 'shares' ? 'hisse se' : 'alag-alag'}
                    </span>
                  </span>
                  <span className="e-a num">{formatINR(e.amountPaise)}</span>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="settle">
          {/* kaun kisko de */}
          {summary.transfers.length === 0 ? (
            <div className="settle-done">✅ Hisaab barabar hai — kisi ko kuch dena nahi</div>
          ) : (
            <>
              <div className="section-title"><h2 style={{ fontSize: 15 }}>Kaun kisko de</h2></div>
              {summary.transfers.map((t, i) => (
                <div className="transfer" key={i}>
                  <span className="t-from">{t.from.name}</span>
                  <span className="t-arrow">{Icon.arrow}</span>
                  <span className="t-to">{t.to.name}</span>
                  <span className="t-amt num">{formatINR(t.amountPaise)}</span>
                </div>
              ))}
            </>
          )}

          {/* kisne kitna diya */}
          <div className="section-title"><h2 style={{ fontSize: 15 }}>Kisne kitna diya</h2></div>
          {summary.balances.map((b) => (
            <div className="bal-row" key={b.member.id}>
              <span className="grow">{b.member.name}</span>
              <span className="bal-paid num">{formatINR(b.paidPaise)}</span>
              <span className="bal-net num" data-tone={b.netPaise >= 0 ? 'good' : 'bad'}>
                {b.netPaise > 0 ? `+${formatINR(b.netPaise)}` : b.netPaise < 0 ? formatINR(b.netPaise) : '—'}
              </span>
            </div>
          ))}

          {/* khitab */}
          {awards.length > 0 && (
            <>
              <div className="section-title"><h2 style={{ fontSize: 15 }}>Khitab 🏆</h2></div>
              <div className="awards">
                {awards.map((a) => (
                  <div className="award" key={a.id}>
                    <span className="award-emoji">{a.emoji}</span>
                    <span>
                      <span className="e-t">{a.title}</span>
                      <span className="e-s">{a.member.name} · {a.detail}</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <button className="btn btn-ghost btn-block" style={{ marginTop: 20 }} onClick={() => void share()}>
            {Icon.share} WhatsApp pe bhejo
          </button>
          <button className="btn btn-quiet btn-block" style={{ color: 'var(--bad)' }}
                  onClick={() => { if (confirm('Poora trip hata dein?')) void deleteTrip(trip.id); }}>
            Trip delete karo
          </button>
        </div>
      )}

      {tab === 'kharche' && (
        <div className="q-foot">
          <button className="btn btn-primary btn-block" onClick={() => setAdding(true)}>{Icon.plus} Kharcha add karo</button>
        </div>
      )}

      {adding && (
        <AddTripExpense
          trip={trip}
          onClose={() => setAdding(false)}
          onAdd={async (exp) => { await addTripExpense(trip.id, exp); setAdding(false); toast.show(`${exp.title} add ho gaya`); }}
        />
      )}

      {toast.node}
    </div>
  );
}

function AddTripExpense({ trip, onClose, onAdd }: {
  trip: Trip;
  onClose(): void;
  onAdd(expense: TripExpense): void;
}) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(trip.members[0]!.id);
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [only, setOnly] = useState<Set<string>>(new Set(trip.members.map((m) => m.id)));

  const amountNum = Number(amount);
  const among = [...only];
  const valid = title.trim() && amountNum > 0 && among.length > 0;

  function toggleMember(id: string) {
    setOnly((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    if (!valid) return;
    const cat = resolveCategory({ title: title.trim(), type: 'expense' }).category;
    onAdd({
      id: newId('texp'),
      title: title.trim(),
      amountPaise: toPaise(amountNum),
      paidBy,
      splitMode: splitMode === 'exact' ? 'equal' : splitMode, // exact abhi nahi
      splitWith: splitMode === 'equal' && among.length < trip.members.length ? among : undefined,
      category: cat,
      occurredAt: new Date().toISOString(),
    });
  }

  return (
    <Sheet onClose={onClose}>
      <h2>Kharcha add karo</h2>

      <div className="field-row">
        <label>
          <span className="f-k">Kis cheez ka</span>
          <input className="text-field" value={title} autoFocus placeholder="Hotel, khana, petrol…"
                 onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label style={{ maxWidth: 130 }}>
          <span className="f-k">Kitne ka</span>
          <input className="text-field num" value={amount} inputMode="numeric" placeholder="0"
                 onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} />
        </label>
      </div>

      <div className="section-title"><h2 style={{ fontSize: 15 }}>Kisne diya</h2></div>
      <div className="chip-pick">
        {trip.members.map((m) => (
          <button key={m.id} className="chip-p" data-on={paidBy === m.id} onClick={() => setPaidBy(m.id)}>{m.name}</button>
        ))}
      </div>

      <div className="section-title"><h2 style={{ fontSize: 15 }}>Kaise baate</h2></div>
      <div className="seg">
        <button data-on={splitMode === 'equal'} onClick={() => setSplitMode('equal')}>Barabar</button>
        <button data-on={splitMode === 'shares'} onClick={() => setSplitMode('shares')} disabled>Hisse se</button>
      </div>

      <p className="hint-line">Kin logon me baate? (jinhone use kiya)</p>
      <div className="chip-pick">
        {trip.members.map((m) => (
          <button key={m.id} className="chip-p" data-on={only.has(m.id)} onClick={() => toggleMember(m.id)}>{m.name}</button>
        ))}
      </div>
      {valid && (
        <p className="hint-line">
          Har banda: {formatINR(Math.floor(toPaise(amountNum) / among.length))}
          {among.length < trip.members.length ? ` (${among.length} logon me)` : ''}
        </p>
      )}

      <div className="q-foot">
        <button className="btn btn-primary btn-block" disabled={!valid} onClick={submit}>Add karo</button>
        <button className="btn btn-quiet btn-block" onClick={onClose}>Rehne do</button>
      </div>
    </Sheet>
  );
}
