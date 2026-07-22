import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  HisaabiEngine, cashBalance, learnCategory, monthRange, safeToSpend, spentBetween, dayRange,
  type CategoryId, type DraftEntry, type Entry, type LearnedRule, type SafeToSpend,
} from '@engine';
import { db, newId, type PendingItem } from './db';
import { DEFAULT_PROFILE, type Profile } from './profile';
import { DEMO_ENTRIES, DEMO_PENDING, DEMO_PROFILE, isDemo } from './demo';
import { getSession, type Session } from './auth';
import { checkAi, remoteAi, type AiStatus } from './ai';
import { handleNotification, startNativeCapture } from './capture';

interface Store {
  ready: boolean;
  profile: Profile | null;
  session: Session | null;
  entries: Entry[];
  rules: LearnedRule[];
  engine: HisaabiEngine;
  ai: { status: AiStatus; provider: string | null };
  pending: PendingItem[];
  route: Route;

  todayPaise: number;
  monthPaise: number;
  cashPaise: number;
  budget: SafeToSpend;

  saveProfile(p: Profile): Promise<void>;
  setSession(s: Session | null): void;
  setRoute(r: Route): void;
  commitDrafts(drafts: DraftEntry[]): Promise<Entry[]>;
  updateEntry(entry: Entry): Promise<void>;
  removeEntry(id: string): Promise<void>;
  /** Naye drafts Review Inbox me daalo (duplicate check ke saath) */
  pushPending(drafts: DraftEntry[]): Promise<number>;
  confirmPending(ids: string[]): Promise<void>;
  ignorePending(ids: string[]): Promise<void>;
  /** User ne category badli — engine ko sikha do */
  teachCategory(key: string, category: CategoryId): Promise<void>;
  reload(): Promise<void>;
}

export type Route = 'home' | 'review';

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSessionState] = useState<Session | null>(getSession());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [rules, setRules] = useState<LearnedRule[]>([]);
  const [pending, setPending] = useState<PendingItem[]>([]);
  // ?route=review — dev/screenshot ke liye
  const [route, setRoute] = useState<Route>(
    () => (new URLSearchParams(location.search).get('route') === 'review' ? 'review' : 'home'),
  );

  const [ai, setAi] = useState<{ status: AiStatus; provider: string | null }>({ status: 'checking', provider: null });

  // AI ho to engine use karega (sirf jab rules ka confidence kam ho), na ho to rules hi kaafi hain
  const engine = useMemo(
    () => new HisaabiEngine({ rules, ai: ai.status === 'on' ? remoteAi : undefined }),
    [rules, ai.status],
  );

  useEffect(() => { void checkAi().then(setAi); }, []);

  // Android: notification aate hi Review Inbox me daal do (ledger me kabhi seedha nahi)
  useEffect(() => {
    return startNativeCapture((n) => {
      void handleNotification(engine, n).then((draft) => {
        if (draft) void pushPendingRef.current([draft]);
      });
    });
  }, [engine]);

  const reload = useCallback(async () => {
    if (isDemo()) {
      setProfile(DEMO_PROFILE);
      setEntries([...DEMO_ENTRIES].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)));
      setRules([]);
      setPending(DEMO_PENDING);
      return;
    }

    const [savedProfile, savedEntries, savedRules, savedPending] = await Promise.all([
      db.getMeta<Profile>('profile'),
      db.allEntries(),
      db.getRules(),
      db.allPending(),
    ]);
    setProfile(savedProfile ?? null);
    setEntries(savedEntries);
    setRules(savedRules);
    setPending(savedPending);
  }, []);

  useEffect(() => {
    reload().finally(() => setReady(true));
  }, [reload]);

  const saveProfile = useCallback(async (p: Profile) => {
    await db.setMeta('profile', p);
    setProfile(p);
  }, []);

  const setSession = useCallback((s: Session | null) => setSessionState(s), []);

  const commitDrafts = useCallback(async (drafts: DraftEntry[]) => {
    const now = new Date().toISOString();
    const saved: Entry[] = drafts.map((d) => ({
      ...d,
      id: newId(),
      status: 'confirmed' as const,
      createdAt: now,
      updatedAt: now,
    }));
    await db.putEntries(saved);
    setEntries((prev) => [...saved, ...prev].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)));
    return saved;
  }, []);

  const updateEntry = useCallback(async (entry: Entry) => {
    const next = { ...entry, updatedAt: new Date().toISOString() };
    await db.putEntry(next);
    setEntries((prev) => prev.map((e) => (e.id === next.id ? next : e)));
  }, []);

  const pushPending = useCallback(async (drafts: DraftEntry[]) => {
    if (!drafts.length) return 0;
    const now = new Date().toISOString();
    const reviewed = engine.review(drafts, entries);

    const items: PendingItem[] = reviewed.map((r) => ({
      id: newId('pen'),
      draft: r.draft,
      duplicates: r.duplicates,
      preSelected: r.preSelected,
      createdAt: now,
    }));

    await db.addPending(items);
    setPending((prev) => [...items, ...prev]);
    return items.length;
  }, [engine, entries]);

  const confirmPending = useCallback(async (ids: string[]) => {
    const picked = pending.filter((p) => ids.includes(p.id));
    if (picked.length) await commitDrafts(picked.map((p) => p.draft));
    await db.removePending(ids);
    setPending((prev) => prev.filter((p) => !ids.includes(p.id)));
  }, [pending, commitDrafts]);

  const ignorePending = useCallback(async (ids: string[]) => {
    await db.removePending(ids);
    setPending((prev) => prev.filter((p) => !ids.includes(p.id)));
  }, []);

  const teachCategory = useCallback(async (key: string, category: CategoryId) => {
    const next = learnCategory(rules, key, category);
    await db.setRules(next);
    setRules(next);
  }, [rules]);

  const removeEntry = useCallback(async (id: string) => {
    await db.deleteEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const derived = useMemo(() => {
    const now = new Date();
    const day = dayRange(now);
    const month = monthRange(now);
    const monthPaise = spentBetween(entries, month.from, month.to);

    return {
      todayPaise: spentBetween(entries, day.from, day.to),
      monthPaise,
      cashPaise: cashBalance(entries),
      budget: safeToSpend({
        monthlyBudgetPaise: profile?.monthlyBudgetPaise ?? DEFAULT_PROFILE.monthlyBudgetPaise,
        spentThisMonthPaise: monthPaise,
        now,
      }),
    };
  }, [entries, profile]);

  // listener ko hamesha taza pushPending chahiye, warna purana state pakad leta hai
  const pushPendingRef = useRef(pushPending);
  pushPendingRef.current = pushPending;

  const value: Store = {
    ready, profile, session, entries, rules, engine, ai, pending, route,
    ...derived,
    saveProfile, setSession, setRoute, commitDrafts, updateEntry, removeEntry,
    pushPending, confirmPending, ignorePending, teachCategory, reload,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore ko StoreProvider ke andar hi use karo');
  return ctx;
}
