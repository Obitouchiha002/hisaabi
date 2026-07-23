import { useState } from 'react';
import { categoryMeta, formatINR, type DraftEntry } from '@engine';
import { Icon, useToast } from '@/components/ui';
import { EntryEditor } from '@/components/EntryEditor';
import { CalcButton } from '@/components/CalcButton';
import { useStore } from '@/lib/store';
import type { PendingItem } from '@/lib/db';
import { simulateNotification } from '@/lib/capture';

/**
 * Review Inbox — auto-capture ka dil.
 *
 * Koi bhi auto-entry seedha ledger me nahi jati. Pehle yahan aati hai:
 * saaf entries pehle se tick hoti hain (ek tap me sab confirm), aur
 * jinme shak hai unpe warning lagi hoti hai.
 */

export function Review() {
  const {
    pending, setRoute, confirmPending, ignorePending,
    teachCategory, pushPending, commitDrafts, engine,
  } = useStore();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(pending.filter((p) => p.preSelected).map((p) => p.id)));
  const [editing, setEditing] = useState<PendingItem | null>(null);
  const [testing, setTesting] = useState(false);
  const [testText, setTestText] = useState('Rs.240 paid to Blinkit via PhonePe');
  const toast = useToast();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirmSelected() {
    const ids = [...selected];
    if (!ids.length) return;
    await confirmPending(ids);
    setSelected(new Set());
    toast.show(`${ids.length} ${ids.length === 1 ? 'entry' : 'entries'} add ho gayi`);
  }

  /** Edit karke save = seedha ledger me, kyunki user ne khud dekh liya hai. */
  async function saveEdited(item: PendingItem, next: DraftEntry, categoryChanged: boolean) {
    if (categoryChanged && next.category) {
      await teachCategory(next.merchant ?? next.title, next.category);
    }
    await commitDrafts([next]);
    await ignorePending([item.id]);
    setEditing(null);
    toast.show('Theek karke add kar diya');
  }

  async function runTest() {
    const draft = simulateNotification(engine, testText);
    if (!draft) {
      toast.show('Is notification se koi kharcha nahi bana');
      return;
    }
    const count = await pushPending([draft]);
    setTesting(false);
    toast.show(`${count} naya card aaya`);
  }

  const total = pending
    .filter((p) => selected.has(p.id))
    .reduce((s, p) => s + (p.draft.type === 'expense' ? p.draft.amountPaise : 0), 0);

  return (
    <div className="screen">
      <header className="home-top">
        <button className="icon-btn" onClick={() => setRoute('home')} aria-label="Peeche">{Icon.back}</button>
        <div className="grow" style={{ marginLeft: 4 }}>
          <div className="greet">Review inbox</div>
          <div className="name">{pending.length ? `${pending.length} pending` : 'Sab clear'}</div>
        </div>
        <CalcButton />
      </header>

      {pending.length === 0 ? (
        <>
          <div className="empty">
            <div className="big">📥</div>
            Yahan wo kharche aayenge jo app khud pakadti hai —<br />
            UPI aur bank ke notifications se.
          </div>

          <div className="dev-note" style={{ marginTop: 18 }}>
            Auto-capture Android app me chalta hai. Yahan test karke dekh sakte ho ki
            parser kaise samajhta hai.
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setTesting((t) => !t)}>
                {testing ? 'Band karo' : 'Notification test karo'}
              </button>
            </div>
          </div>

          {testing && (
            <div style={{ marginTop: 12 }}>
              <textarea
                className="compose"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="Rs.240 paid to Blinkit via PhonePe"
              />
              <div className="hint-row">
                {[
                  'Rs.240 paid to Blinkit via PhonePe',
                  'Your A/c XX1234 is debited by Rs.1200.00',
                  'Rs 2000 credited to your account from Vansh',
                  '123456 is your OTP. Do not share.',
                ].map((t) => (
                  <button key={t} className="hint" onClick={() => setTestText(t)}>{t.slice(0, 28)}…</button>
                ))}
              </div>
              <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={() => void runTest()}>
                Parse karke inbox me daalo
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="review-list">
            {pending.map((item, i) => {
              const d = item.draft;
              const meta = categoryMeta(d.category ?? 'other');
              const risky = d.confidence < 0.6 || item.duplicates.length > 0;

              return (
                <div
                  key={item.id}
                  className="rev-card"
                  data-selected={selected.has(item.id)}
                  data-risky={risky}
                  style={{ animationDelay: `${i * 45}ms` }}
                >
                  <button className="rev-tick" onClick={() => toggle(item.id)} aria-label="Chuno">
                    <span className="o-tick">{Icon.check}</span>
                  </button>

                  <button className="rev-body" onClick={() => setEditing(item)}>
                    <span className="rev-top">
                      <span className="e-ico" aria-hidden="true">{meta.emoji}</span>
                      <span className="grow" style={{ minWidth: 0 }}>
                        <span className="e-t">{d.merchant ?? d.title}</span>
                        <span className="e-s">
                          {meta.label}{d.sourceApp ? ` · ${d.sourceApp}` : ''}
                        </span>
                      </span>
                      <span className="e-a num">{formatINR(d.amountPaise)}</span>
                    </span>

                    {item.duplicates.length > 0 && (
                      <span className="rev-warn">
                        ⚠️ Ye same transaction lagta hai — {item.duplicates[0]!.reasons.join(', ')}
                      </span>
                    )}
                    {d.confidence < 0.6 && item.duplicates.length === 0 && (
                      <span className="rev-warn">🤔 Pakka nahi — ek baar dekh lo</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="dock">
            <button
              className="btn btn-quiet"
              onClick={() => void ignorePending(pending.map((p) => p.id))}
            >
              Sab hatao
            </button>
            <button
              className="btn btn-primary grow"
              disabled={selected.size === 0}
              onClick={() => void confirmSelected()}
            >
              {selected.size ? `${selected.size} confirm · ${formatINR(total)}` : 'Kuch chuno'}
            </button>
          </div>
        </>
      )}

      {editing && (
        <EntryEditor
          draft={editing.draft}
          title="Theek karke add karo"
          onClose={() => setEditing(null)}
          onDelete={() => { void ignorePending([editing.id]); setEditing(null); }}
          onSave={(next, changed) => void saveEdited(editing, next, changed)}
        />
      )}

      {toast.node}
    </div>
  );
}
