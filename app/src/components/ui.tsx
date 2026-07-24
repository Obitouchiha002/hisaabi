import { useEffect, useRef, useState, type ReactNode } from 'react';
import { pushBackHandler } from '@/lib/back';
import { formatINR } from '@engine';
import { useT } from '@/lib/i18n';

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
  /* Pehle wala gear sooraj jaisa dikh raha tha — isliye settings ka button
     dikhta hi nahi tha. Ab asli gear hai. */
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  ),
  send: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12h14M12 5.5l6.5 6.5-6.5 6.5" />
    </svg>
  ),
  keyboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M8 14h8" />
    </svg>
  ),
  share: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15V3.5M12 3.5 8 7.5M12 3.5l4 4" />
      <path d="M5 12v6.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V12" />
    </svg>
  ),
  calc: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="2.8" width="15" height="18.4" rx="2.6" />
      <path d="M8 7h8" />
      <path d="M8.4 12h.01M12 12h.01M15.6 12h.01M8.4 16.5h.01M12 16.5h.01M15.6 16.5h.01" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.4A6.5 6.5 0 0 1 21.5 20" />
    </svg>
  ),
  inbox: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 13h4l1.5 3h7L17 13h4" />
      <path d="M5.5 5h13l2.5 8v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4z" />
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
  option: { id: T; emoji: string; title: string; titleHi?: string; sub?: string; subHi?: string };
  selected: boolean;
  onSelect(id: T): void;
  index?: number;
}) {
  const t = useT();
  const sub = option.sub ? t(option.sub, option.subHi ?? option.sub) : null;
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
        <span className="o-title">{t(option.title, option.titleHi ?? option.title)}</span>
        {sub && <span className="o-sub">{sub}</span>}
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

    // Back dabane pe pehle sheet band ho — screen tab tak wahi rahe
    const off = pushBackHandler(() => { onClose(); return true; });

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      off();
    };
  }, [onClose]);

  /* Keyboard khulte hi sheet ka aadha hissa uske neeche chhup jata tha —
     jo likh rahe ho wahi nahi dikhta. visualViewport batata hai ki asli me
     kitni jagah bachi hai; wahi height sheet ko de dete hain. */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const apply = () => {
      const hidden = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--kb', `${Math.round(hidden)}px`);
    };

    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      document.documentElement.style.removeProperty('--kb');
    };
  }, []);

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

export interface ToastAction {
  label: string;
  run(): void;
}

export function Toast({ message, action }: { message: string; action?: ToastAction }) {
  return (
    <div className="toast">
      <span className="toast-msg">{message}</span>
      {action && (
        <button className="toast-act" onClick={action.run}>{action.label}</button>
      )}
    </div>
  );
}

export function useToast() {
  const [state, setState] = useState<{ message: string; action?: ToastAction } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setState(null);
  };

  /* Undo wale toast ko thoda zyada waqt — 2 second me "Wapas lao" dabana
     mushkil hai, aur delete undo na ho paye to bharosa tootta hai. */
  const show = (text: string, action?: ToastAction) => {
    if (timer.current) clearTimeout(timer.current);
    setState({ message: text, action });
    timer.current = setTimeout(() => setState(null), action ? 5000 : 2200);
  };

  const node = state ? (
    <Toast
      message={state.message}
      action={state.action ? { label: state.action.label, run: () => { state.action!.run(); hide(); } } : undefined}
    />
  ) : null;

  return { message: state?.message ?? null, show, hide, node };
}
