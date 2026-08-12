/**
 * Recurring bills — rent, EMI, Netflix jaise har mahine wale kharche. Ek baar
 * set karo; jis din due ho, app khulte hi khud entry ban jaati hai (mahine me
 * ek hi baar — double-count nahi). Sab is phone me (localStorage).
 */
import type { CategoryId } from '@engine';

const KEY = 'hisaabi-bills';

export interface Bill {
  id: string;
  title: string;
  amountPaise: number;
  category: CategoryId;
  dayOfMonth: number;      // 1..28 (safe for har mahine)
  loggedMonths: string[];  // ['2026-08', ...] — kis mahine log ho chuka
}

function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getBills(): Bill[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Bill[]) : [];
  } catch {
    return [];
  }
}

function saveBills(bills: Bill[]): void {
  localStorage.setItem(KEY, JSON.stringify(bills));
}

export function addBill(b: Omit<Bill, 'id' | 'loggedMonths'>): Bill {
  const bill: Bill = { ...b, id: `bill_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`, loggedMonths: [] };
  saveBills([...getBills(), bill]);
  return bill;
}

export function removeBill(id: string): void {
  saveBills(getBills().filter((b) => b.id !== id));
}

/** Jo bills is mahine due ho chuke aur abhi tak log nahi hue. */
export function dueBills(now = new Date()): Bill[] {
  const mk = monthKey(now);
  return getBills().filter((b) => now.getDate() >= b.dayOfMonth && !b.loggedMonths.includes(mk));
}

/** Log ho gaya — is mahine ke liye mark kar do (dobara na bane). */
export function markLogged(id: string, now = new Date()): void {
  const mk = monthKey(now);
  saveBills(getBills().map((b) => (b.id === id && !b.loggedMonths.includes(mk) ? { ...b, loggedMonths: [...b.loggedMonths, mk] } : b)));
}
