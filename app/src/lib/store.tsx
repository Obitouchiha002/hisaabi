import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  HisaabiEngine, cashBalance, monthRange, safeToSpend, spentBetween, dayRange,
  type DraftEntry, type Entry, type LearnedRule, type SafeToSpend,
} from '@engine';
import { db, newId } from './db';
import { DEFAULT_PROFILE, type Profile } from './profile';
import { DEMO_ENTRIES, DEMO_PROFILE, isDemo } from './demo';
import { getSession, type Session } from './auth';

interface Store {
  ready: boolean;
  profile: Profile | null;
  session: Session | null;
  entries: Entry[];
  rules: LearnedRule[];
  engine: HisaabiEngine;

  todayPaise: number;
  monthPaise: number;
  cashPaise: number;
  budget: SafeToSpend;

  saveProfile(p: Profile): Promise<void>;
  setSession(s: Session | null): void;
  commitDrafts(drafts: DraftEntry[]): Promise<Entry[]>;
  removeEntry(id: string): Promise<void>;
  reload(): Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSessionState] = useState<Session | null>(getSession());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [rules, setRules] = useState<LearnedRule[]>([]);

  const engine = useMemo(() => new HisaabiEngine({ rules }), [rules]);

  const reload = useCallback(async () => {
    if (isDemo()) {
      setProfile(DEMO_PROFILE);
      setEntries([...DEMO_ENTRIES].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)));
      setRules([]);
      return;
    }

    const [savedProfile, savedEntries, savedRules] = await Promise.all([
      db.getMeta<Profile>('profile'),
      db.allEntries(),
      db.getRules(),
    ]);
    setProfile(savedProfile ?? null);
    setEntries(savedEntries);
    setRules(savedRules);
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

  const value: Store = {
    ready, profile, session, entries, rules, engine,
    ...derived,
    saveProfile, setSession, commitDrafts, removeEntry, reload,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore ko StoreProvider ke andar hi use karo');
  return ctx;
}
