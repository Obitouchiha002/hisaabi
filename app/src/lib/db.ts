/**
 * Local-first storage. Sab kuch pehle phone me — sync baad me.
 *
 * IndexedDB pehli pasand hai. Par private mode, purane WebView aur kuch
 * embedded browsers me IndexedDB kholta hi nahi (na error deta hai, na khulta) —
 * isliye 1.5 second ka timeout hai aur localStorage wala fallback.
 * App splash pe kabhi atakni nahi chahiye.
 */

import type { DraftEntry, DuplicateMatch, Entry, LearnedRule, RawEvent, Trip } from '@engine';

const DB_NAME = 'hisaabi';
const VERSION = 3;
const LS_PREFIX = 'hisaabi:';

/**
 * Cold start pe WebView bahut slow hota hai — IndexedDB khulne me kuch second
 * lag sakte hain. Pehle 1.5s ka timeout tha; usse app fallback pe chali jati thi
 * aur user ko khaali app dikhti thi — bilkul aisa jaise saara data ud gaya ho.
 *
 * Isliye: pehli baar 8 second do. Aur agar IDB pehle kabhi chal chuka hai
 * (matlab data usi me hai), to 30 second tak intezaar karo — kyunki fallback pe
 * jaana yahan data khone ke barabar hai. Splash thoda zyada dikhe, chalega.
 */
const OPEN_TIMEOUT_FIRST_MS = 8000;
const OPEN_TIMEOUT_KNOWN_MS = 30000;

/** Kaunsa storage chala tha — taki har launch pe faisla badle nahi. */
const MODE_KEY = LS_PREFIX + 'storage';

type StoreName = 'entries' | 'raw' | 'meta' | 'pending' | 'trips';

/** Review Inbox ka ek card — abhi ledger me nahi hai. */
export interface PendingItem {
  id: string;
  draft: DraftEntry;
  duplicates: DuplicateMatch[];
  preSelected: boolean;
  createdAt: string;
}
type Mode = 'idb' | 'ls';

let mode: Mode | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

function openIdb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no indexedDB')); return; }

    const req = indexedDB.open(DB_NAME, VERSION);

    req.onupgradeneeded = () => {
      const database = req.result;
      if (!database.objectStoreNames.contains('entries')) {
        database.createObjectStore('entries', { keyPath: 'id' }).createIndex('occurredAt', 'occurredAt');
      }
      if (!database.objectStoreNames.contains('raw')) database.createObjectStore('raw', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('meta')) database.createObjectStore('meta');
      if (!database.objectStoreNames.contains('pending')) database.createObjectStore('pending', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('trips')) database.createObjectStore('trips', { keyPath: 'id' });
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB error'));
    req.onblocked = () => reject(new Error('indexedDB blocked'));
  });

  return dbPromise;
}

function rememberedMode(): Mode | null {
  try {
    const value = localStorage.getItem(MODE_KEY);
    return value === 'idb' || value === 'ls' ? value : null;
  } catch {
    return null;
  }
}

function remember(value: Mode): void {
  try { localStorage.setItem(MODE_KEY, value); } catch { /* private mode */ }
}

async function ensureMode(): Promise<Mode> {
  if (mode) return mode;

  const known = rememberedMode();

  // Pehle se localStorage pe hain to wahin rehna hai — data wahan hai
  if (known === 'ls') { mode = 'ls'; return mode; }

  try {
    const limit = known === 'idb' ? OPEN_TIMEOUT_KNOWN_MS : OPEN_TIMEOUT_FIRST_MS;
    await Promise.race([
      openIdb(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), limit)),
    ]);
    mode = 'idb';
  } catch {
    dbPromise = null;
    mode = 'ls';
  }

  remember(mode);
  return mode;
}

/* ---------- localStorage fallback ---------- */

function lsRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsWrite(key: string, value: unknown): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    // quota bhar gaya — chup-chaap chhod do, app chalti rahe
  }
}

/* ---------- IndexedDB helpers ---------- */

async function idbRun<T>(store: StoreName, mode_: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const database = await openIdb();
  return new Promise<T>((resolve, reject) => {
    const tx = database.transaction(store, mode_);
    const req = fn(tx.objectStore(store));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

/* ---------- public API ---------- */

export const db = {
  async putEntries(entries: Entry[]): Promise<void> {
    if ((await ensureMode()) === 'ls') {
      const all = lsRead<Entry[]>('entries', []);
      const byId = new Map(all.map((e) => [e.id, e]));
      entries.forEach((e) => byId.set(e.id, e));
      lsWrite('entries', [...byId.values()]);
      return;
    }

    const database = await openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction('entries', 'readwrite');
      const store = tx.objectStore('entries');
      entries.forEach((e) => store.put(e));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async putEntry(entry: Entry): Promise<void> {
    await db.putEntries([entry]);
  },

  async allEntries(): Promise<Entry[]> {
    const rows = (await ensureMode()) === 'ls'
      ? lsRead<Entry[]>('entries', [])
      : await idbRun<Entry[]>('entries', 'readonly', (s) => s.getAll());
    return rows.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  },

  async deleteEntry(id: string): Promise<void> {
    if ((await ensureMode()) === 'ls') {
      lsWrite('entries', lsRead<Entry[]>('entries', []).filter((e) => e.id !== id));
      return;
    }
    await idbRun('entries', 'readwrite', (s) => s.delete(id));
  },

  /** Raw event kabhi delete nahi hota — parser sudhrne pe purani entries dobara parse kar sakein. */
  async putRaw(event: RawEvent): Promise<void> {
    if ((await ensureMode()) === 'ls') {
      lsWrite('raw', [...lsRead<RawEvent[]>('raw', []), event].slice(-500));
      return;
    }
    await idbRun('raw', 'readwrite', (s) => s.put(event));
  },

  async allRaw(): Promise<RawEvent[]> {
    if ((await ensureMode()) === 'ls') return lsRead<RawEvent[]>('raw', []);
    return idbRun<RawEvent[]>('raw', 'readonly', (s) => s.getAll());
  },

  /* ---------- Review Inbox ---------- */

  async addPending(items: PendingItem[]): Promise<void> {
    if (!items.length) return;

    if ((await ensureMode()) === 'ls') {
      const all = lsRead<PendingItem[]>('pending', []);
      const byId = new Map(all.map((p) => [p.id, p]));
      items.forEach((p) => byId.set(p.id, p));
      lsWrite('pending', [...byId.values()]);
      return;
    }

    const database = await openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction('pending', 'readwrite');
      const store = tx.objectStore('pending');
      items.forEach((p) => store.put(p));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async allPending(): Promise<PendingItem[]> {
    const rows = (await ensureMode()) === 'ls'
      ? lsRead<PendingItem[]>('pending', [])
      : await idbRun<PendingItem[]>('pending', 'readonly', (s) => s.getAll());
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async removePending(ids: string[]): Promise<void> {
    if (!ids.length) return;

    if ((await ensureMode()) === 'ls') {
      const drop = new Set(ids);
      lsWrite('pending', lsRead<PendingItem[]>('pending', []).filter((p) => !drop.has(p.id)));
      return;
    }

    const database = await openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction('pending', 'readwrite');
      const store = tx.objectStore('pending');
      ids.forEach((id) => store.delete(id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /* ---------- trips ---------- */

  async putTrip(trip: Trip): Promise<void> {
    if ((await ensureMode()) === 'ls') {
      const all = lsRead<Trip[]>('trips', []).filter((t) => t.id !== trip.id);
      lsWrite('trips', [trip, ...all]);
      return;
    }
    await idbRun('trips', 'readwrite', (s) => s.put(trip));
  },

  async allTrips(): Promise<Trip[]> {
    const rows = (await ensureMode()) === 'ls'
      ? lsRead<Trip[]>('trips', [])
      : await idbRun<Trip[]>('trips', 'readonly', (s) => s.getAll());
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async deleteTrip(id: string): Promise<void> {
    if ((await ensureMode()) === 'ls') {
      lsWrite('trips', lsRead<Trip[]>('trips', []).filter((t) => t.id !== id));
      return;
    }
    await idbRun('trips', 'readwrite', (s) => s.delete(id));
  },

  async getMeta<T>(key: string): Promise<T | undefined> {
    if ((await ensureMode()) === 'ls') return lsRead<T | undefined>(`meta:${key}`, undefined);
    return idbRun<T | undefined>('meta', 'readonly', (s) => s.get(key));
  },

  async setMeta(key: string, value: unknown): Promise<void> {
    if ((await ensureMode()) === 'ls') { lsWrite(`meta:${key}`, value); return; }
    await idbRun('meta', 'readwrite', (s) => s.put(value, key));
  },

  async getRules(): Promise<LearnedRule[]> {
    return (await db.getMeta<LearnedRule[]>('rules')) ?? [];
  },

  async setRules(rules: LearnedRule[]): Promise<void> {
    await db.setMeta('rules', rules);
  },

  /** "Sab data hata do" — privacy promise ka hissa. */
  async wipe(): Promise<void> {
    if ((await ensureMode()) === 'ls') {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(LS_PREFIX))
        .forEach((k) => localStorage.removeItem(k));
      return;
    }

    const database = await openIdb();
    await Promise.all(
      (['entries', 'raw', 'meta', 'pending', 'trips'] as StoreName[]).map(
        (name) =>
          new Promise<void>((resolve, reject) => {
            const tx = database.transaction(name, 'readwrite');
            tx.objectStore(name).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          }),
      ),
    );
  },

  /** Debug/settings me dikhane ke liye */
  async storageMode(): Promise<Mode> {
    return ensureMode();
  },
};

export function newId(prefix = 'txn'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
