import { useMemo, useState } from 'react';
import { calculate, formatINR, looksLikeMath } from '@engine';
import { Icon, Sheet } from '@/components/ui';

/**
 * Har screen pe calculator.
 *
 * Kharcha likhte waqt jod-ghata sabse zyada tab chahiye hota hai jab tum
 * hisaab dekh rahe ho — "is mahine 7,577 gaya, 12,000 me se kitna bacha?".
 * Us waqt doosri app kholna hi sabse bada jhanjhat hai, isliye ye button
 * har screen ke header me rehta hai.
 *
 * Ganit engine ka `calculate()` karta hai — koi eval() nahi.
 */
export function CalcButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Calculator">
        {Icon.calc}
      </button>
      {open && <CalcSheet onClose={() => setOpen(false)} />}
    </>
  );
}

const KEYS = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '%', '+'];

function CalcSheet({ onClose }: { onClose(): void }) {
  const [text, setText] = useState('');
  const result = useMemo(() => (looksLikeMath(text) ? calculate(text) : null), [text]);

  function press(k: string) {
    setText((t) => t + k);
  }

  return (
    <Sheet onClose={onClose}>
      <div className="section-title"><h2>Calculator</h2></div>

      <input
        className="text-field num calc-input"
        value={text}
        inputMode="text"
        autoFocus
        placeholder="1200 ÷ 4"
        onChange={(e) => setText(e.target.value)}
      />

      <div className="calc-out" data-big={result && !result.error ? '' : undefined}>
        {result?.error
          ? <span className="calc-err">{result.error}</span>
          : <span className="calc-val num">
              {result ? `= ${formatINR(Math.round(result.value * 100))}` : '= —'}
            </span>}
      </div>

      <div className="calc-pad">
        {KEYS.map((k) => (
          <button key={k} className="calc-key" data-op={/[÷×−+%]/.test(k) ? '' : undefined}
                  onClick={() => press(k)}>
            {k}
          </button>
        ))}
        <button className="calc-key" data-wide="" onClick={() => setText('')}>Saaf</button>
        <button className="calc-key" onClick={() => setText((t) => t.slice(0, -1))}>⌫</button>
      </div>

      <div className="q-foot">
        <button className="btn btn-quiet btn-block" onClick={onClose}>Band karo</button>
      </div>
    </Sheet>
  );
}
