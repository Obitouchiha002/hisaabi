/**
 * Backup.
 *
 * Saal bhar ka paise ka hisaab ek hi phone me pada rehna — paise wali app me
 * ye darawni baat hai. Phone kho gaya, paani gir gaya, ya app hat gayi to sab
 * gaya. Isliye hafte me ek baar yaad dilate hain.
 *
 * Sync abhi nahi hai, isliye backup = ek file jo user khud kahin rakh le
 * (WhatsApp me khud ko bhej de, Drive me daal de — jahan bhi).
 */

import type { Entry, Trip } from '@engine';
import type { Profile } from './profile';

const LAST_KEY = 'hisaabi-last-backup';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface BackupData {
  app: 'hisaabi';
  version: 1;
  savedAt: string;
  profile: Profile | null;
  entries: Entry[];
  trips: Trip[];
}

export function lastBackupAt(): Date | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return raw ? new Date(raw) : null;
  } catch {
    return null;
  }
}

function markBackedUp(): void {
  try { localStorage.setItem(LAST_KEY, new Date().toISOString()); } catch { /* private mode */ }
}

/**
 * Yaad dilana chahiye ya nahi.
 *
 * Naye user ko pehle din hi backup ki baat karna bekaar hai — pehle usme kuch
 * data to aa jaye. Isliye 10 entries ke baad, aur hafte me ek baar.
 */
export function needsBackup(entryCount: number): boolean {
  if (entryCount < 10) return false;
  const last = lastBackupAt();
  if (!last) return true;
  return Date.now() - last.getTime() > WEEK_MS;
}

export function buildBackup(data: Omit<BackupData, 'app' | 'version' | 'savedAt'>): BackupData {
  return { app: 'hisaabi', version: 1, savedAt: new Date().toISOString(), ...data };
}

/**
 * File banao aur share/download karo.
 *
 * Android pe share sheet khulti hai (WhatsApp, Drive, jahan chaho).
 * Browser me seedha download.
 */
export async function saveBackup(data: BackupData): Promise<'shared' | 'downloaded' | 'failed'> {
  const json = JSON.stringify(data, null, 2);
  const name = `hisaabi-backup-${data.savedAt.slice(0, 10)}.json`;

  try {
    const file = new File([json], name, { type: 'application/json' });

    // navigator.share file ke saath — Android pe share sheet
    const shareData = { files: [file], title: 'Hisaabi backup' };
    if (navigator.canShare?.(shareData) && navigator.share) {
      await navigator.share(shareData);
      markBackedUp();
      return 'shared';
    }
  } catch (err) {
    // user ne share cancel kiya — ye fail nahi hai
    if (err instanceof Error && err.name === 'AbortError') return 'failed';
  }

  try {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    markBackedUp();
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

/** CSV — Excel/Sheets me kholne ke liye. */
export function toCsv(entries: Entry[]): string {
  const head = ['Tareekh', 'Kya', 'Category', 'Kitna', 'Type', 'Kaise', 'Kiske saath'];

  const rows = entries
    .filter((e) => e.status === 'confirmed')
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    .map((e) => [
      new Date(e.occurredAt).toLocaleString('en-IN'),
      e.merchant ?? e.title,
      e.category ?? 'other',
      (e.amountPaise / 100).toFixed(2),
      e.type,
      e.paidWith,
      e.counterparty ?? '',
    ]);

  return [head, ...rows]
    .map((r) => r.map(csvCell).join(','))
    .join('\n');
}

/** Comma ya quote wale naam CSV ko tod dete hain. */
function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function downloadCsv(entries: Entry[]): void {
  const url = URL.createObjectURL(new Blob([toCsv(entries)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `hisaabi-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Backup file wapas padho — sirf hamari hi file. */
export function parseBackup(text: string): BackupData | null {
  try {
    const data = JSON.parse(text) as BackupData;
    if (data?.app !== 'hisaabi' || !Array.isArray(data.entries)) return null;
    return data;
  } catch {
    return null;
  }
}
