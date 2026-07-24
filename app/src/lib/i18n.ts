/**
 * Do bhasha — English (default) aur Hindi (Roman me).
 *
 * Jaan-boojh kar keys nahi banaye. `t('Today', 'Aaj')` — dono lafz wahin call
 * pe likhe hain. Isse do fayde: (1) alag dictionary file maintain nahi karni,
 * (2) key aur text ka mel na baithne wala bug ho hi nahi sakta. Do bhasha ke
 * liye ye sabse saaf tareeka hai.
 *
 * English default hai — app professional dikhe. User Settings me se Hindi pe
 * ja sakta hai; choice phone me yaad rehti hai.
 */

import { useSyncExternalStore } from 'react';

export type Lang = 'en' | 'hi';

const KEY = 'hisaabi-lang';

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'hi') return saved;
  } catch { /* storage band — default se kaam chalega */ }
  return 'en';
}

let current: Lang = initial();
const listeners = new Set<() => void>();

// <html lang> ko shuru me hi sahi kar do (accessibility + browser translate)
try { document.documentElement.setAttribute('lang', current); } catch { /* SSR/test */ }

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try { localStorage.setItem(KEY, lang); } catch { /* koi baat nahi */ }
  document.documentElement.setAttribute('lang', lang === 'hi' ? 'hi' : 'en');
  for (const fn of listeners) fn();
}

/**
 * Abhi ki bhasha ke hisaab se lafz do.
 *
 * `t('Home', 'Ghar')` → English mode me "Home", Hindi mode me "Ghar".
 * React ke bahar (lib, adapter) me bhi seedha bula sakte ho — bas language
 * badalne pe wo apne aap dobara nahi chalega.
 */
export function t(en: string, hi: string): string {
  return current === 'hi' ? hi : en;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Component ko bhasha se jodta hai — language badle to component dobara render
 * ho jata hai. Return kiya hua `t` global se padhta hai, isliye hamesha taaza.
 *
 *   const t = useT();
 *   return <h1>{t('Settings', 'Settings')}</h1>;
 */
export function useT(): typeof t {
  useSyncExternalStore(subscribe, getLang, getLang);
  return t;
}

/** Sirf bhasha chahiye (t nahi) — jaise toggle dikhane ke liye. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}
