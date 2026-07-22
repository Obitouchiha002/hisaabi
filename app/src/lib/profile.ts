/**
 * Onboarding — 5 sawaal + 1 feedback sawaal.
 *
 * Har sawaal ka koi na koi kaam hai. Jis sawaal se app me kuch badalta nahi,
 * wo sawaal poochna hi nahi chahiye.
 */

import type { PaidWith } from '@engine';
import { toPaise } from '@engine';

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
  title: string;
  sub?: string;
}

export const WORK_OPTIONS: Option<WorkId>[] = [
  { id: 'student',  emoji: '🎓', title: 'Student hoon',      sub: 'Pocket money, mess, recharge' },
  { id: 'job',      emoji: '💼', title: 'Job karta hoon',    sub: 'Salary, EMI, rozana kharche' },
  { id: 'business', emoji: '🏪', title: 'Dukaan / business', sub: 'Rozana lena-dena zyada' },
  { id: 'ghar',     emoji: '🏠', title: 'Ghar sambhalta hoon', sub: 'Ration, bijli, bacchon ka kharcha' },
];

export const TONE_OPTIONS: Option<ToneId>[] = [
  { id: 'dosti',        emoji: '🤝', title: 'Dost jaisa',   sub: '"Bhai, aaj thoda zyada ho gaya"' },
  { id: 'professional', emoji: '🎩', title: 'Seedha-saada', sub: '"Aaj ₹340 kharch hua"' },
];

export const ADDRESS_OPTIONS: Option<AddressId>[] = [
  { id: 'bhai',  emoji: '🙋‍♂️', title: 'Bhai' },
  { id: 'behen', emoji: '🙋‍♀️', title: 'Behen' },
  { id: 'naam',  emoji: '✨',   title: 'Sirf naam se bulao' },
];

export const BUDGET_OPTIONS: Option<string>[] = [
  { id: '5000',  emoji: '🌱', title: '₹5,000 tak',       sub: 'Chhota kharcha' },
  { id: '12000', emoji: '🍃', title: '₹5,000 – ₹15,000' },
  { id: '25000', emoji: '🌳', title: '₹15,000 – ₹35,000' },
  { id: '50000', emoji: '🏔️', title: '₹35,000 se zyada' },
];

export const PAY_OPTIONS: Option<PaidWith>[] = [
  { id: 'digital', emoji: '📲', title: 'UPI zyada',   sub: 'GPay, PhonePe, Paytm' },
  { id: 'cash',    emoji: '💵', title: 'Cash zyada',  sub: 'Note-paise se' },
  { id: 'unknown', emoji: '⚖️', title: 'Dono barabar' },
];

export const DISCOVERY_OPTIONS: Option<DiscoveryId>[] = [
  { id: 'instagram', emoji: '📱', title: 'Instagram / YouTube' },
  { id: 'dost',      emoji: '👋', title: 'Dost ne bataya' },
  { id: 'google',    emoji: '🔍', title: 'Google pe search karke' },
  { id: 'github',    emoji: '🐙', title: 'GitHub / dev community' },
  { id: 'aur',       emoji: '🤷', title: 'Kahin aur se' },
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
  return p.name || 'dost';
}

export function greeting(p: Profile, now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Subah bakhair';
  if (h < 17) return 'Namaste';
  if (h < 21) return 'Shaam bakhair';
  return 'Raat ho gayi';
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
