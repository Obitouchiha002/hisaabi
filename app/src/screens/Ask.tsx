import { useRef, useState } from 'react';
import { formatINR, type AskAnswer } from '@engine';
import { Icon, Sheet } from '@/components/ui';
import { useStore } from '@/lib/store';

const SUGGESTIONS = [
  'is mahine kitna kharch hua',
  'aaj kitna gaya',
  'sabse bada kharcha kya tha',
  'is hafte khane pe kitna gaya',
];

export function AskSheet({ onClose }: { onClose(): void }) {
  const { engine, entries } = useStore();
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [miss, setMiss] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function ask(question: string) {
    if (!question.trim()) return;
    setQ(question);
    setBusy(true);
    setMiss(false);
    const res = await engine.ask(question, entries);
    setAnswer(res);
    setMiss(!res);
    setBusy(false);
  }

  return (
    <Sheet onClose={onClose}>
      <h2>Poocho kuch bhi</h2>

      <form onSubmit={(e) => { e.preventDefault(); void ask(q); }}>
        <input
          ref={ref}
          autoFocus
          className="text-field"
          placeholder="is mahine swiggy pe kitna gaya?"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>

      {!answer && !miss && (
        <div className="hint-row">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="hint" type="button" onClick={() => void ask(s)}>{s}</button>
          ))}
        </div>
      )}

      {busy && <div className="dev-note">Dekh raha hoon…</div>}

      {answer && !busy && (
        <>
          <div className="hero-card" style={{ marginTop: 16 }}>
            <div className="k">Jawab</div>
            <div className="sub" style={{ fontSize: 17, color: 'var(--ink)', marginTop: 6 }}>
              {answer.answer}
            </div>
          </div>

          {answer.result.entries.length > 0 && (
            <div className="parse-out">
              {answer.result.entries.slice(0, 5).map((e, i) => (
                <div className="entry" key={e.id} style={{ animationDelay: `${i * 40}ms` }}>
                  <span>
                    <span className="e-t">{e.merchant ?? e.title}</span>
                    <span className="e-s">{new Date(e.occurredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </span>
                  <span className="e-a num">{formatINR(e.amountPaise)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {miss && !busy && (
        <div className="dev-note" style={{ marginTop: 16 }}>
          {Icon.spark} Ye sawaal abhi samajh nahi aaya. Rules se na bane to AI plan banata hai —
          wo Pro me aa raha hai. Tab tak aise poocho: “is mahine swiggy pe kitna gaya”.
        </div>
      )}

      <div className="q-foot">
        <button className="btn btn-ghost btn-block" onClick={onClose}>Band karo</button>
      </div>
    </Sheet>
  );
}
