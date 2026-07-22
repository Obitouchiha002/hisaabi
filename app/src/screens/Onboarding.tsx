import { useEffect, useRef, useState } from 'react';
import { toPaise } from '@engine';
import {
  ADDRESS_OPTIONS, BUDGET_OPTIONS, DEFAULT_PROFILE, DISCOVERY_OPTIONS,
  TONE_OPTIONS, WORK_OPTIONS, type AddressId, type DiscoveryId, type Profile,
  type ToneId, type WorkId,
} from '@/lib/profile';
import { Icon, OptionRow } from '@/components/ui';

/**
 * Hello → 5 sawaal → 1 feedback sawaal → shuru.
 * MCQ chunte hi apne aap aage badhta hai — koi extra tap nahi.
 */

const HELLO_MS = 2300;
const AUTO_NEXT_MS = 280;

export function Onboarding({ onDone }: { onDone(profile: Profile): void }) {
  // ?step=3 — dev/screenshot ke liye seedha kisi sawaal pe
  const [step, setStep] = useState(() => Number(new URLSearchParams(location.search).get('step') ?? 0));
  const [back, setBack] = useState(false);
  const [draft, setDraft] = useState<Profile>({ ...DEFAULT_PROFILE });
  const timer = useRef<number>();

  const total = 6;

  useEffect(() => {
    if (step !== 0) return;
    const t = window.setTimeout(() => go(1), HELLO_MS);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function go(next: number) {
    setBack(next < step);
    setStep(next);
  }

  function pick<K extends keyof Profile>(key: K, value: Profile[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (step >= total) finish({ ...draft, [key]: value });
      else go(step + 1);
    }, AUTO_NEXT_MS);
  }

  function finish(profile: Profile) {
    onDone({ ...profile, createdAt: new Date().toISOString() });
  }

  if (step === 0) return <Hello onSkip={() => go(1)} />;

  return (
    <div className={`screen ${back ? 'back' : ''}`} key={step}>
      <div className="row" style={{ gap: 12, marginBottom: 18 }}>
        {step > 1 ? (
          <button className="icon-btn" onClick={() => go(step - 1)} aria-label="Peeche">{Icon.back}</button>
        ) : (
          <span style={{ width: 44 }} />
        )}
        <div className="grow progress" style={{ margin: 0 }}>
          <i style={{ width: `${(step / total) * 100}%` }} />
        </div>
        <span style={{ fontSize: 13, color: 'var(--ink-3)' }} className="num">{step}/{total}</span>
      </div>

      {step === 1 && <NameStep value={draft.name} onNext={(name) => { setDraft((d) => ({ ...d, name })); go(2); }} />}

      {step === 2 && (
        <Question
          step="Sawaal 2"
          title="Aap kya karte ho?"
          sub="Isse Hisaabi tumhare hisaab ke categories set karega."
          options={WORK_OPTIONS}
          selected={draft.work}
          onSelect={(id: WorkId) => pick('work', id)}
        />
      )}

      {step === 3 && (
        <Question
          step="Sawaal 3"
          title="Baat kaise karun?"
          sub="Hisaabi isi andaz me tumse baat karega."
          options={TONE_OPTIONS}
          selected={draft.tone}
          onSelect={(id: ToneId) => pick('tone', id)}
        />
      )}

      {step === 4 && (
        <Question
          step="Sawaal 4"
          title="Tumhe kaise bulaun?"
          options={ADDRESS_OPTIONS}
          selected={draft.address}
          onSelect={(id: AddressId) => pick('address', id)}
        />
      )}

      {step === 5 && (
        <Question
          step="Sawaal 5"
          title="Mahine me kitna kharch hota hai?"
          sub="Andaza kaafi hai — baad me badal sakte ho. Isi se 'aaj kitna safe hai' banta hai."
          options={BUDGET_OPTIONS}
          selected={String(draft.monthlyBudgetPaise / 100)}
          onSelect={(id: string) => pick('monthlyBudgetPaise', toPaise(Number(id)))}
        />
      )}

      {step === 6 && (
        <Question
          step="Aakhri sawaal"
          title="Hisaabi ke baare me kahan se pata laga?"
          sub="Ye sirf mere liye — jaanne ke liye ki log kahan se aa rahe hain."
          options={DISCOVERY_OPTIONS}
          selected={draft.discovery}
          onSelect={(id: DiscoveryId) => pick('discovery', id)}
        />
      )}
    </div>
  );
}

/* ---------- hello ---------- */

function Hello({ onSkip }: { onSkip(): void }) {
  return (
    <div className="screen hello" onClick={onSkip}>
      <span className="mark" aria-hidden="true">₹</span>
      <h1>
        {'Namaste'.split('').map((c, i) => (
          <span className="word" key={i} style={{ animationDelay: `${180 + i * 45}ms` }}>{c}</span>
        ))}
        <span className="word" style={{ animationDelay: '560ms' }}>&nbsp;👋</span>
      </h1>
      <p>Main Hisaabi hoon.<br />Do minute me tumhare hisaab ka saathi ban jaunga.</p>
    </div>
  );
}

/* ---------- steps ---------- */

function NameStep({ value, onNext }: { value: string; onNext(name: string): void }) {
  const [name, setName] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 380);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <div className="q-head">
        <div className="q-step">Sawaal 1</div>
        <h1>Naam kya hai tumhara?</h1>
        <p>Sirf tumhe bulane ke liye. Kahin bheja nahi jata.</p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) onNext(name.trim()); }}
      >
        <input
          ref={ref}
          className="text-field"
          placeholder="Tumhara naam"
          value={name}
          maxLength={24}
          autoComplete="given-name"
          onChange={(e) => setName(e.target.value)}
        />
        <div className="q-foot">
          <button className="btn btn-primary btn-block" type="submit" disabled={!name.trim()}>
            Aage badho
          </button>
        </div>
      </form>
    </>
  );
}

function Question<T extends string>({
  step, title, sub, options, selected, onSelect,
}: {
  step: string;
  title: string;
  sub?: string;
  options: Array<{ id: T; emoji: string; title: string; sub?: string }>;
  selected: T | string;
  onSelect(id: T): void;
}) {
  const [choice, setChoice] = useState<string>('');

  return (
    <>
      <div className="q-head">
        <div className="q-step">{step}</div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>

      <div className="options">
        {options.map((o, i) => (
          <OptionRow
            key={o.id}
            option={o}
            index={i}
            selected={choice ? choice === o.id : selected === o.id}
            onSelect={(id) => { setChoice(id); onSelect(id); }}
          />
        ))}
      </div>
    </>
  );
}
