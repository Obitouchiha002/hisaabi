/**
 * Coach chat ki history — is phone me save (localStorage). Reload/band karne pe
 * baat-cheet bani rehti hai; backup me bhi jaati hai (continuity). Sirf aakhri
 * ~40 message rakhte hain, taaki bloat na ho.
 */
const KEY = 'hisaabi-chat';
const MAX = 40;

export interface StoredMsg { role: 'coach' | 'me'; text: string; sub?: string }

export function loadChat(): StoredMsg[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as StoredMsg[]) : [];
    return Array.isArray(arr) ? arr.slice(-MAX) : [];
  } catch {
    return [];
  }
}

export function saveChat(msgs: StoredMsg[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(msgs.slice(-MAX)));
  } catch { /* private mode / full */ }
}
