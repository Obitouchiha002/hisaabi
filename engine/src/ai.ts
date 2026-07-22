/**
 * AI ki seema (boundary).
 *
 * Engine ko ye nahi pata ki peeche kaunsa model hai. App ek adapter deti hai;
 * na de to engine sirf rules pe chalta rahega — offline me app poori kaam karti hai.
 *
 * AI kya karega: ulti-seedhi Hinglish line samajhna, category suggest karna,
 *                sawaal ko QueryPlan me badalna.
 * AI kya NAHI karega: koi bhi jod-ghata, ledger me save, duplicate ka faisla,
 *                     aur notification text to kabhi chhuega hi nahi.
 */

import type { CategoryId, DraftEntry } from './types.js';
import type { QueryPlan } from './ask.js';
import { scrubPII } from './normalize.js';

export interface AiContext {
  /** user ke top merchants — accuracy badhane ke liye */
  knownMerchants?: string[];
  /** ISO date, taki "kal" ka matlab model ko pata ho */
  today?: string;
}

export interface AiAdapter {
  parseEntries?(text: string, ctx: AiContext): Promise<DraftEntry[]>;
  suggestCategory?(merchant: string, title: string): Promise<CategoryId | null>;
  planQuery?(question: string, ctx: AiContext): Promise<QueryPlan | null>;
}

/** Isse neeche confidence ho to hi AI ko bulao. Warna paisa aur time dono bachta hai. */
export const AI_CONFIDENCE_THRESHOLD = 0.6;

export function needsAi(drafts: DraftEntry[], rawText: string): boolean {
  if (drafts.length === 0) return rawText.trim().length > 0;
  return drafts.some((d) => d.confidence < AI_CONFIDENCE_THRESHOLD);
}

export const PARSE_SYSTEM_PROMPT = `Tum ek Hinglish expense parser ho.
User bolta ya likhta hai ki usne kya kharch kiya. Tumhe har kharche ko alag JSON object me todna hai.

Rules:
- Output SIRF JSON array ho, aur kuch nahi.
- Har object: {"title": string, "amount": number (rupees), "type": "expense"|"income"|"cash_in"}
- Hindi numbers samjho: bees=20, saath=60, sau=100, dhai sau=250, sava sau=125, dedh hazaar=1500.
- ATM se paisa nikalna "cash_in" hai, kharcha nahi.
- Salary/refund/paisa aana "income" hai.
- Amount na mile to us hisse ko chhod do. Kuch invent mat karo.
- title chhota rakho (1-3 shabd), jaisa user ne bola waisa hi.`;

export function buildParseUserPrompt(text: string, ctx: AiContext = {}): string {
  const lines = [`Text: "${scrubPII(text)}"`];
  if (ctx.today) lines.push(`Aaj ki date: ${ctx.today}`);
  if (ctx.knownMerchants?.length) {
    lines.push(`User ke common merchants: ${ctx.knownMerchants.slice(0, 20).join(', ')}`);
  }
  return lines.join('\n');
}

export const ASK_SYSTEM_PROMPT = `Tum ek query planner ho. User apne kharchon ke baare me sawaal poochta hai.
Tumhe SIRF ek JSON QueryPlan return karna hai — koi number, koi jawab nahi. Total database nikalega.

QueryPlan shape:
{"metric":"sum"|"count"|"avg"|"max"|"list",
 "filter":{"text"?:string,"category"?:string,"type"?:"expense"|"income","paidWith"?:"cash"|"digital"},
 "range":{"label":"today"|"yesterday"|"this_week"|"last_week"|"this_month"|"last_month"|"this_year"|"all_time"},
 "compareToPrevious"?:boolean,
 "groupBy"?:"category"|"merchant"|"day"}

Categories: food, grocery, travel, bills, shopping, health, rent, education, fun, other, income.
Samajh na aaye to {"metric":"sum","filter":{"type":"expense"},"range":{"label":"this_month"}} de do.`;

export function buildAskUserPrompt(question: string, ctx: AiContext = {}): string {
  const lines = [`Sawaal: "${scrubPII(question)}"`];
  if (ctx.today) lines.push(`Aaj: ${ctx.today}`);
  return lines.join('\n');
}
