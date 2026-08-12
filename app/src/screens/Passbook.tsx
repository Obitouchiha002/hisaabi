import { useMemo, useState } from 'react';
import { monthRange, formatINR, type DraftEntry, type Entry } from '@engine';
import { useToast } from '@/components/ui';
import { EntryEditor } from '@/components/EntryEditor';
import { useStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { catEmoji, entrySubtitle } from '@/lib/labels';
import { loadMoneyProfile } from '@/lib/moneyProfile';
import { getBalance } from '@/lib/balance';

/**
 * Passbook — accounting book jaisa. Har transaction In (+) / Out (−) ke saath,
 * running balance, mahine ke totals, aur ek reconciliation:
 *   Kamai  =  Kharch  +  Jeb me  +  (jo hisaab me nahi)
 * Agar match na ho, "jo nahi" ko ek tap me 'other' kharch maan lo.
 */
const INFLOW = new Set(['income', 'cash_in', 'refund', 'borrowed']);
const OUTFLOW = new Set(['expense', 'lent']);

export function Passbook() {
  const t = useT();
  const { entries, setRoute, commitDrafts, updateEntry, removeEntry, teachCategory } = useStore();
  const [editing, setEditing] = useState<Entry | null>(null);
  const toast = useToast();
  const income = loadMoneyProfile()?.incomePaise ?? 0;
  const balPaise = getBalance()?.paise ?? null;

  const now = new Date();
  const { rows, totalIn, totalOut } = useMemo(() => {
    const { from, to } = monthRange(now);
    const f = from.getTime(), tt = to.getTime();
    const month = entries
      .filter((e) => e.status === 'confirmed' && (INFLOW.has(e.type) || OUTFLOW.has(e.type)))
      .filter((e) => { const at = new Date(e.occurredAt).getTime(); return at >= f && at <= tt; })
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

    let running = 0, tIn = 0, tOut = 0;
    const list = month.map((e) => {
      const inn = INFLOW.has(e.type) ? e.amountPaise : 0;
      const out = OUTFLOW.has(e.type) ? e.amountPaise : 0;
      running += inn - out; tIn += inn; tOut += out;
      return { e, inn, out, running };
    });
    return { rows: list.reverse(), totalIn: tIn, totalOut: tOut };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  const unaccounted = income > 0 && balPaise !== null ? income - totalOut - balPaise : 0;

  async function markOther() {
    if (unaccounted <= 0) return;
    await commitDrafts([{
      title: t('Earlier this month', 'Is mahine pehle'),
      amountPaise: unaccounted, type: 'expense', paidWith: 'unknown',
      occurredAt: new Date().toISOString(), source: 'manual', category: 'other', confidence: 1, warnings: [],
    } as DraftEntry]);
    toast.show(t(`${formatINR(unaccounted)} added as other spend`, `${formatINR(unaccounted)} 'other' kharch me daala`));
  }

  return (
    <div className="screen">
      <header className="home-top">
        <div className="grow">
          <div className="greet">{t('Your book', 'Tumhari book')}</div>
          <div className="name">{t('Cash passbook', 'Cash passbook')}</div>
        </div>
      </header>

      {/* month totals */}
      <div className="pb-totals">
        <div className="pbt"><span className="pbt-k">📥 {t('In', 'Aaya')}</span><span className="num good">{formatINR(totalIn)}</span></div>
        <div className="pbt"><span className="pbt-k">📤 {t('Out', 'Gaya')}</span><span className="num bad">{formatINR(totalOut)}</span></div>
        <div className="pbt"><span className="pbt-k">💰 {t('In hand', 'Jeb me')}</span><span className="num">{balPaise !== null ? formatINR(balPaise) : '—'}</span></div>
      </div>

      {/* reconciliation */}
      {income > 0 && balPaise !== null && (
        <div className={`pb-recon ${unaccounted > 0 ? 'off' : 'ok'}`}>
          {unaccounted > 0 ? (
            <>
              <p>{t(`Earned ${formatINR(income)} − spent ${formatINR(totalOut)} − in hand ${formatINR(balPaise)} = `, `Kamai ${formatINR(income)} − kharch ${formatINR(totalOut)} − jeb ${formatINR(balPaise)} = `)}<b>{formatINR(unaccounted)} {t('unaccounted', 'ka hisaab nahi')}</b></p>
              <button className="btn btn-primary btn-sm" onClick={() => void markOther()}>{t(`Mark ${formatINR(unaccounted)} as other spend`, `${formatINR(unaccounted)} 'other' me daalo`)}</button>
            </>
          ) : (
            <p>✅ {t(`It all adds up — ${formatINR(income)} earned = ${formatINR(totalOut)} spent + ${formatINR(balPaise)} in hand.`, `Sab match — ${formatINR(income)} kamai = ${formatINR(totalOut)} kharch + ${formatINR(balPaise)} jeb me.`)}</p>
          )}
        </div>
      )}

      {/* journal */}
      {rows.length === 0 ? (
        <p className="rep-empty">{t('No cash movement logged this month yet.', 'Is mahine abhi koi len-den nahi.')}</p>
      ) : (
        <div className="pb-journal">
          <div className="pbj-head">
            <span>{t('Particulars', 'Vivaran')}</span>
            <span className="num">{t('In', 'Aaya')}</span>
            <span className="num">{t('Out', 'Gaya')}</span>
            <span className="num">{t('Balance', 'Baaki')}</span>
          </div>
          {rows.map(({ e, inn, out, running }) => (
            <button className="pbj-row" key={e.id} onClick={() => setEditing(e)}>
              <span className="pbj-part">
                <span className="pbj-ico">{catEmoji(e.category ?? 'other')}</span>
                <span><b>{e.title}</b><i>{fmtDay(e.occurredAt)} · {entrySubtitle(e.type, e.category ?? 'other')}</i></span>
              </span>
              <span className="num good">{inn > 0 ? formatINR(inn) : ''}</span>
              <span className="num bad">{out > 0 ? formatINR(out) : ''}</span>
              <span className="num pbj-bal" data-neg={running < 0 ? '' : undefined}>{formatINR(running)}</span>
            </button>
          ))}
        </div>
      )}

      <button className="pb-see-all" onClick={() => setRoute('history')}>{t('Older entries →', 'Purane entries →')}</button>

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
      {toast.node}
    </div>
  );
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MON[d.getMonth()]}`;
}
