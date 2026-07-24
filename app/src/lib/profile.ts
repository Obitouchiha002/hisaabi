/**
 * Onboarding — 5 sawaal + 1 feedback sawaal.
 *
 * Har sawaal ka koi na koi kaam hai. Jis sawaal se app me kuch badalta nahi,
 * wo sawaal poochna hi nahi chahiye.
 */

import type { PaidWith } from '@engine';
import { toPaise } from '@engine';
import { getLang, t } from './i18n';

export type WorkId = 'student' | 'job' | 'business' | 'ghar';
export type ToneId = 'dosti' | 'professional';
export type AddressId = 'bhai' | 'behen' | 'naam';
export type DiscoveryId = 'instagram' | 'dost' | 'google' | 'github' | 'aur';

export interface Profile {
  name: string;
  work: WorkId;
  tone: ToneId;
  address: AddressId;
  monthlyBudgetPaise: number;
  defaultPaidWith: PaidWith;
  discovery: DiscoveryId;
  createdAt: string;
}

export interface Option<T extends string> {
  id: T;
  emoji: string;
  /** English (default) */
  title: string;
  /** Hindi (Roman) */
  titleHi?: string;
  sub?: string;
  subHi?: string;
}

/** Option ki abhi ki bhasha me text. OptionRow aur baaki jagah yahi use karte hain. */
export function optTitle<T extends string>(o: Option<T>): string {
  return t(o.title, o.titleHi ?? o.title);
}
export function optSub<T extends string>(o: Option<T>): string | undefined {
  if (!o.sub) return undefined;
  return t(o.sub, o.subHi ?? o.sub);
}

export const WORK_OPTIONS: Option<WorkId>[] = [
  { id: 'student',  emoji: '🎓', title: "I'm a student",        titleHi: 'Student hoon',        sub: 'Pocket money, mess, recharge' },
  { id: 'job',      emoji: '💼', title: 'I have a job',         titleHi: 'Job karta hoon',      sub: 'Salary, EMI, daily spends',  subHi: 'Salary, EMI, rozana kharche' },
  { id: 'business', emoji: '🏪', title: 'Shop / business',      titleHi: 'Dukaan / business',   sub: 'Lots of daily transactions', subHi: 'Rozana lena-dena zyada' },
  { id: 'ghar',     emoji: '🏠', title: 'I run the home',       titleHi: 'Ghar sambhalta hoon', sub: 'Ration, bills, kids',        subHi: 'Ration, bijli, bacchon ka kharcha' },
];

export const TONE_OPTIONS: Option<ToneId>[] = [
  { id: 'dosti',        emoji: '🤝', title: 'Like a friend', titleHi: 'Dost jaisa',   sub: '"Bhai, that was a bit much today"', subHi: '"Bhai, aaj thoda zyada ho gaya"' },
  { id: 'professional', emoji: '🎩', title: 'Plain & simple', titleHi: 'Seedha-saada', sub: '"You spent ₹340 today"',            subHi: '"Aaj ₹340 kharch hua"' },
];

export const ADDRESS_OPTIONS: Option<AddressId>[] = [
  { id: 'bhai',  emoji: '🙋‍♂️', title: 'Bhai',           titleHi: 'Bhai' },
  { id: 'behen', emoji: '🙋‍♀️', title: 'Behen',          titleHi: 'Behen' },
  { id: 'naam',  emoji: '✨',   title: 'Just my name',    titleHi: 'Sirf naam se bulao' },
];

export const BUDGET_OPTIONS: Option<string>[] = [
  { id: '5000',  emoji: '🌱', title: 'Up to ₹5,000',    titleHi: '₹5,000 tak', sub: 'Small spends', subHi: 'Chhota kharcha' },
  { id: '12000', emoji: '🍃', title: '₹5,000 – ₹15,000' },
  { id: '25000', emoji: '🌳', title: '₹15,000 – ₹35,000' },
  { id: '50000', emoji: '🏔️', title: 'More than ₹35,000', titleHi: '₹35,000 se zyada' },
];

export const PAY_OPTIONS: Option<PaidWith>[] = [
  { id: 'digital', emoji: '📲', title: 'Mostly UPI',   titleHi: 'UPI zyada',  sub: 'GPay, PhonePe, Paytm' },
  { id: 'cash',    emoji: '💵', title: 'Mostly cash',  titleHi: 'Cash zyada', sub: 'Notes & coins', subHi: 'Note-paise se' },
  { id: 'unknown', emoji: '⚖️', title: 'About equal',  titleHi: 'Dono barabar' },
];

export const DISCOVERY_OPTIONS: Option<DiscoveryId>[] = [
  { id: 'instagram', emoji: '📱', title: 'Instagram / YouTube', titleHi: 'Instagram / YouTube' },
  { id: 'dost',      emoji: '👋', title: 'A friend told me',    titleHi: 'Dost ne bataya' },
  { id: 'google',    emoji: '🔍', title: 'Searched on Google',  titleHi: 'Google pe search karke' },
  { id: 'github',    emoji: '🐙', title: 'GitHub / dev community', titleHi: 'GitHub / dev community' },
  { id: 'aur',       emoji: '🤷', title: 'Somewhere else',      titleHi: 'Kahin aur se' },
];

export const DEFAULT_PROFILE: Profile = {
  name: '',
  work: 'job',
  tone: 'dosti',
  address: 'naam',
  monthlyBudgetPaise: toPaise(12000),
  defaultPaidWith: 'digital',
  discovery: 'aur',
  createdAt: '',
};

/** App user ko kaise bulaye. */
export function addressWord(p: Profile): string {
  if (p.address === 'bhai') return 'Bhai';
  if (p.address === 'behen') return 'Behen';
  return p.name || t('friend', 'dost');
}

export function greeting(p: Profile, now = new Date()): string {
  const h = now.getHours();
  if (getLang() === 'hi') {
    if (h < 12) return 'Subah bakhair';
    if (h < 17) return 'Namaste';
    if (h < 21) return 'Shaam bakhair';
    return 'Raat ho gayi';
  }
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Hello';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

/**
 * AI ko user ka andaz batane wali line. Yahi profile AiAdapter ke context me jati hai,
 * taki jawab user ki bhasha me aaye.
 */
export function toneInstruction(p: Profile): string {
  const who =
    p.work === 'student' ? 'ek student' :
    p.work === 'business' ? 'ek dukaan/business wala' :
    p.work === 'ghar' ? 'ghar sambhalne wala' : 'ek job karne wala';

  return p.tone === 'dosti'
    ? `User ${who} hai, naam ${p.name || 'unknown'}. Dost ki tarah baat karo — chhote vaakya, Hinglish, "${addressWord(p)}" bolke.`
    : `User ${who} hai, naam ${p.name || 'unknown'}. Seedhi-saadi Hinglish me baat karo, bina zyada tapak ke.`;
}
