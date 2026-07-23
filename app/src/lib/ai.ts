/**
 * App ka AI adapter — `/api/ai` se baat karta hai (key server pe rehti hai).
 *
 * Engine bina AI ke bhi poora chalta hai; ye sirf tab bulaya jata hai jab
 * rule parser ka confidence kam ho. AI band ho, net na ho, ya jawab kharab aaye —
 * app kabhi rukti nahi, bas rules wala result rakh leti hai.
 */

import {
  resolveRange, resolveWhen, scrubPII, toPaise,
  type AiAdapter, type AiContext, type DraftEntry, type QueryPlan,
} from '@engine';

// Web pe same-origin. Android app me server hota hi nahi, isliye wahan poora URL chahiye:
// app/.env me VITE_API_BASE=https://hisaabi.vercel.app daal do.
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
const ENDPOINT = `${API_BASE}/api/ai`;

export type AiStatus = 'checking' | 'on' | 'off';

let cachedStatus: AiStatus = 'checking';
let statusProvider: string | null = null;

export async function checkAi(): Promise<{ status: AiStatus; provider: string | null }> {
  try {
    const res = await fetch(ENDPOINT, { method: 'GET' });
    if (!res.ok) throw new Error('down');
    const json = (await res.json()) as { provider?: string | null };
    cachedStatus = json.provider ? 'on' : 'off';
    statusProvider = json.provider ?? null;
  } catch {
    cachedStatus = 'off';
    statusProvider = null;
  }
  return { status: cachedStatus, provider: statusProvider };
}

async function call(task: 'parse' | 'ask', text: string, context: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // scrubPII do baar chal jaye to bhi theek — engine ke andar bhi hota hai
    body: JSON.stringify({ task, text: scrubPII(text), context }),
  });

  if (!res.ok) throw new Error(`ai ${res.status}`);
  const json = (await res.json()) as { result?: unknown };
  return json.result;
}

export const remoteAi: AiAdapter = {
  async parseEntries(text: string, ctx: AiContext): Promise<DraftEntry[]> {
    const result = await call('parse', text, { ...ctx });
    if (!Array.isArray(result)) return [];

    const now = new Date().toISOString();

    return result
      .map((row) => toDraft(row as Record<string, unknown>, now))
      .filter((d): d is DraftEntry => d !== null);
  },

  async planQuery(question: string, ctx: AiContext): Promise<QueryPlan | null> {
    const result = await call('ask', question, { ...ctx });
    return isPlan(result) ? normalisePlan(result) : null;
  },
};

/* ---------- AI ka JSON → engine ka type ---------- */

function toDraft(row: Record<string, unknown>, now: string): DraftEntry | null {
  const amount = Number(row.amount);
  const title = String(row.title ?? '').trim();
  if (!isFinite(amount) || amount <= 0 || !title) return null;

  const KNOWN = ['income', 'cash_in', 'lent', 'borrowed'] as const;
  const type = (KNOWN as readonly string[]).includes(String(row.type))
    ? (row.type as (typeof KNOWN)[number])
    : 'expense';

  const counterparty = typeof row.counterparty === 'string' && row.counterparty.trim()
    ? row.counterparty.trim().slice(0, 24)
    : undefined;

  // AI ne waqt bataya ho ("kal shaam") to wahi lagao — warna aaj ka hisaab galat hoga
  const when = resolveWhen(
    typeof row.daysAgo === 'number' || typeof row.hour === 'number'
      ? {
          daysAgo: Math.max(0, Math.min(60, Number(row.daysAgo) || 0)),
          hour: typeof row.hour === 'number' && row.hour >= 0 && row.hour <= 23 ? row.hour : undefined,
          matched: [],
        }
      : null,
    new Date(now),
  );

  return {
    title: title.slice(0, 40),
    amountPaise: toPaise(amount),
    type,
    paidWith: type === 'cash_in' ? 'cash' : 'unknown',
    counterparty,
    occurredAt: when.toISOString(),
    source: 'manual',
    // AI ka jawab hamesha review ke liye jata hai — confidence jaan-boojh ke kam
    confidence: 0.7,
    warnings: ['ai_parsed'],
  };
}

function isPlan(value: unknown): value is QueryPlan {
  return typeof value === 'object' && value !== null && 'metric' in value;
}

/**
 * AI sirf range ka label deta hai — asli tarikhein engine banata hai.
 * Model se dates mangwana matlab galat mahina, galat jawab.
 */
function normalisePlan(plan: QueryPlan): QueryPlan {
  return {
    ...plan,
    filter: plan.filter ?? {},
    range: resolveRange(plan.range?.label ?? 'this_month'),
  };
}

export function aiStatus(): { status: AiStatus; provider: string | null } {
  return { status: cachedStatus, provider: statusProvider };
}
