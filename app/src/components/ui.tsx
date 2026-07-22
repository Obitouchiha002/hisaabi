import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatINR } from '@engine';

/* ---------- icons ---------- */

export const Icon = {
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5 9.5 18 20 6.5" />
    </svg>
  ),
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  ),
  mic: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2.5" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  spark: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 4.9L19 9.8l-4.6 2.4L12 17l-2.4-4.8L5 9.8l5.1-1.9z" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </svg>
  ),
};

/* ---------- count up ---------- */

export function Amount({ paise, className = '' }: { paise: number; className?: string }) {
  const [shown, setShown] = useState(paise);
  const from = useRef(paise);
  const raf = useRef<number>();

  useEffect(() => {
    const start = performance.now();
    const startVal = from.current;
    const delta = paise - startVal;
    if (delta === 0) return;

    const tick = (t: number) => {
      const p = Math.min((t - start) / 650, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(startVal + delta * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else from.current = paise;
    };

    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [paise]);

  return <span className={`num ${className}`}>{formatINR(shown)}</span>;
}

/* ---------- option row ---------- */

export function OptionRow<T extends string>({
  option, selected, onSelect, index = 0,
}: {
  option: { id: T; emoji: string; title: string; sub?: string };
  selected: boolean;
  onSelect(id: T): void;
  index?: number;
}) {
  return (
    <button
      className="option"
      data-selected={selected}
      style={{ animationDelay: `${index * 55}ms` }}
      onClick={() => onSelect(option.id)}
      type="button"
    >
      <span className="o-emoji" aria-hidden="true">{option.emoji}</span>
      <span>
        <span className="o-title">{option.title}</span>
        {option.sub && <span className="o-sub">{option.sub}</span>}
      </span>
      <span className="o-tick">{Icon.check}</span>
    </button>
  );
}

/* ---------- sheet ---------- */

export function Sheet({ children, onClose }: { children: ReactNode; onClose(): void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-grab" />
        {children}
      </div>
    </>
  );
}

/* ---------- toast ---------- */

export function Toast({ message }: { message: string }) {
  return <div className="toast">{message}</div>;
}

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);

  const show = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2200);
  };

  return { message, show, node: message ? <Toast message={message} /> : null };
}
