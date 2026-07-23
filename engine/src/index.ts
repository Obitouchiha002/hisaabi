/**
 * Hisaabi Engine — public API.
 *
 * Yaad rahe: engine kuch save nahi karta. Wo Draft banata hai, duplicate batata hai,
 * category lagata hai — aur bas. Save karna app ka kaam hai, user ke confirm ke baad.
 */

export * from './types.js';
export * from './money.js';
export * from './numbers.js';
export * from './normalize.js';
export * from './parse.js';
export * from './notifications.js';
export * from './categories.js';
export * from './duplicates.js';
export * from './budget.js';
export * from './ask.js';
export * from './query.js';
export * from './ai.js';
export * from './planner.js';
export * from './trips.js';
export * from './when.js';

import type { DraftEntry, Entry, EngineContext, InputSource, LearnedRule, RawEvent, ReviewItem } from './types.js';
import type { AiAdapter, AiContext } from './ai.js';
import type { QueryPlan } from './ask.js';
import { needsAi } from './ai.js';
import { parseText } from './parse.js';
import { parseNotification } from './notifications.js';
import { resolveCategory } from './categories.js';
import { findDuplicates } from './duplicates.js';
import { detectIntent, planQuery } from './ask.js';
import { answerText, runQuery, type QueryResult } from './query.js';

export interface EngineOptions extends EngineContext {
  ai?: AiAdapter;
}

export type RouteResult =
  | { intent: 'expense'; drafts: DraftEntry[] }
  | { intent: 'question'; answer: AskAnswer | null }
  | { intent: 'unknown' };

export interface AskAnswer {
  plan: QueryPlan;
  result: QueryResult;
  answer: string;
  /** rules se bana ya AI se */
  plannedBy: 'rules' | 'ai';
}

export class HisaabiEngine {
  private rules: LearnedRule[];
  private ai?: AiAdapter;
  private ctx: EngineContext;

  constructor(opts: EngineOptions = {}) {
    this.rules = opts.rules ?? [];
    this.ai = opts.ai;
    this.ctx = opts;
  }

  setRules(rules: LearnedRule[]): void {
    this.rules = rules;
  }

  getRules(): LearnedRule[] {
    return this.rules;
  }

  /**
   * Bola/likha hua text → drafts.
   * Pehle rules. Confidence kam ho tabhi AI — isi se cost ₹0.30/user/month rehti hai.
   */
  async ingestText(
    text: string,
    opts: { source?: InputSource; transcriptConfidence?: number; aiContext?: AiContext; now?: Date } = {},
  ): Promise<DraftEntry[]> {
    const now = opts.now ?? this.ctx.now ?? new Date();
    let drafts = parseText(text, {
      ...this.ctx,
      now,
      source: opts.source ?? 'manual',
      transcriptConfidence: opts.transcriptConfidence,
    });

    if (this.ai?.parseEntries && needsAi(drafts, text)) {
      try {
        const aiDrafts = await this.ai.parseEntries(text, {
          today: now.toISOString().slice(0, 10),
          ...opts.aiContext,
        });
        if (aiDrafts?.length) {
          drafts = aiDrafts.map((d) => ({
            ...d,
            source: opts.source ?? 'manual',
            occurredAt: d.occurredAt || now.toISOString(),
            warnings: [...(d.warnings ?? []), 'ai_parsed' as const],
          }));
        }
      } catch {
        // AI fail ho to rules wala result hi chalega — app kabhi rukti nahi
      }
    }

    return drafts.map((d) => this.withCategory(d));
  }

  /**
   * Ek hi jagah se kaam chalane ke liye: text dekh kar khud tay karta hai ki
   * ye kharcha hai ya sawaal, aur usi hisaab se jawab deta hai.
   *
   * User ko ye sochna hi nahi chahiye ki kaunsa button dabana hai.
   */
  async handle(
    text: string,
    entries: Entry[],
    opts: { source?: InputSource; aiContext?: AiContext } = {},
  ): Promise<RouteResult> {
    const trimmed = text.trim();
    if (!trimmed) return { intent: 'unknown' };

    // pehle sasta rasta: rules se parse karke dekho amount mila ya nahi
    const quick = parseText(trimmed, { ...this.ctx, source: opts.source ?? 'manual' });
    const intent = detectIntent(trimmed, quick.length > 0);

    if (intent === 'question') {
      return { intent, answer: await this.ask(trimmed, entries, opts.aiContext) };
    }

    const drafts = await this.ingestText(trimmed, opts);
    if (drafts.length) return { intent: 'expense', drafts };

    // kharcha nahi bana — shayad sawaal tha
    const answer = await this.ask(trimmed, entries, opts.aiContext);
    if (answer) return { intent: 'question', answer };

    return { intent: 'unknown' };
  }

  /** Notification → draft. Ye poora on-device hai, AI kabhi nahi. */
  ingestNotification(event: RawEvent): DraftEntry | null {
    const draft = parseNotification(event, { now: this.ctx.now });
    return draft ? this.withCategory(draft) : null;
  }

  /** Drafts → Review Inbox cards (duplicate check + batch-confirm flag). */
  review(drafts: DraftEntry[], recent: Entry[] = []): ReviewItem[] {
    return drafts.map((draft) => {
      const duplicates = findDuplicates(draft, recent);
      return {
        draft: duplicates.length
          ? { ...draft, warnings: [...draft.warnings, 'possible_duplicate' as const] }
          : draft,
        duplicates,
        preSelected: duplicates.length === 0 && draft.confidence >= 0.85,
      };
    });
  }

  /** Sawaal → jawab. Number hamesha ledger se aata hai. */
  async ask(question: string, entries: Entry[], aiContext?: AiContext): Promise<AskAnswer | null> {
    const now = this.ctx.now ?? new Date();
    let plan = planQuery(question, now);
    let plannedBy: 'rules' | 'ai' = 'rules';

    if (!plan && this.ai?.planQuery) {
      try {
        plan = await this.ai.planQuery(question, {
          today: now.toISOString().slice(0, 10),
          ...aiContext,
        });
        plannedBy = 'ai';
      } catch {
        plan = null;
      }
    }

    if (!plan) return null;

    const result = runQuery(plan, entries);
    return { plan, result, answer: answerText(plan, result), plannedBy };
  }

  private withCategory(draft: DraftEntry): DraftEntry {
    if (draft.category) return draft;
    const res = resolveCategory(draft, this.rules);
    return {
      ...draft,
      category: res.category,
      categorySource: res.source,
      confidence: Math.round(Math.min(draft.confidence, (draft.confidence + res.confidence) / 2 + 0.1) * 100) / 100,
    };
  }
}
