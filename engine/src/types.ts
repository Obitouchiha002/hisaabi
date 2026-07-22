/**
 * Hisaabi engine ke core types.
 *
 * Do niyam jo kabhi nahi tootne chahiye:
 *   1. Paisa hamesha INTEGER PAISE me (₹20 = 2000). Float me paisa rakhna bug ki jad hai.
 *   2. Engine kabhi kuch save nahi karta — sirf Draft banata hai. Save app karti hai,
 *      user ke confirm karne ke baad.
 */

/** Paise (integer). ₹20 = 2000 */
export type Paise = number;

export type EntryType =
  | 'expense'   // paisa gaya
  | 'income'    // paisa aaya
  | 'cash_in';  // ATM se nikala — kharcha nahi, sirf cash wallet me aaya

export type PaidWith = 'cash' | 'digital' | 'unknown';

export type InputSource = 'manual' | 'voice' | 'notification' | 'telegram' | 'import';

export type CategoryId =
  | 'food' | 'grocery' | 'travel' | 'bills' | 'shopping'
  | 'health' | 'rent' | 'education' | 'fun' | 'other' | 'income';

/** Jo bhi andar aaya — kabhi delete nahi hota, taki parser sudhrne pe dobara parse ho sake. */
export interface RawEvent {
  id: string;
  source: InputSource;
  rawText: string;
  /** ISO string */
  receivedAt: string;
  meta?: {
    /** Android package, e.g. com.phonepe.app */
    packageName?: string;
    appLabel?: string;
    title?: string;
    body?: string;
    /** notification ka apna id — dobara aane pe duplicate rokne ke liye */
    externalId?: string;
  };
}

/** Engine ka output. Abhi ledger me nahi hai — Review Inbox me hai. */
export interface DraftEntry {
  title: string;
  amountPaise: Paise;
  type: EntryType;
  paidWith: PaidWith;
  /** ISO string */
  occurredAt: string;
  source: InputSource;
  merchant?: string;
  category?: CategoryId;
  categorySource?: 'learned' | 'merchant-rule' | 'keyword' | 'ai' | 'fallback';
  /** 0..1 — kitna bharosa hai is parse pe */
  confidence: number;
  warnings: DraftWarning[];
  note?: string;
  rawEventId?: string;
  /** notification se aaya transaction reference, duplicate check ke liye */
  ref?: string;
  /** kis app se aaya — PhonePe / GPay / SBI */
  sourceApp?: string;
}

export type DraftWarning =
  | 'title_missing'
  | 'amount_uncertain'
  | 'merchant_unknown'
  | 'possible_duplicate'
  | 'large_amount'
  | 'ai_parsed';

/** Confirm hone ke baad ledger me ye jata hai. */
export interface Entry extends DraftEntry {
  id: string;
  status: 'confirmed' | 'ignored' | 'duplicate';
  createdAt: string;
  updatedAt: string;
}

/** Category memory — user ne baar-baar jo theek kiya. */
export interface LearnedRule {
  /** normalized merchant ya title key */
  key: string;
  category: CategoryId;
  /** user ne kitni baar yahi correction kiya */
  count: number;
  updatedAt: string;
}

export interface DuplicateMatch {
  entryId: string;
  score: number;
  reasons: string[];
}

/** Review Inbox ka ek card. */
export interface ReviewItem {
  draft: DraftEntry;
  duplicates: DuplicateMatch[];
  /** confidence >= 0.85 aur koi duplicate nahi → batch confirm me pre-selected */
  preSelected: boolean;
}

export interface EngineContext {
  /** abhi ka time — tests deterministic rakhne ke liye inject hota hai */
  now?: Date;
  rules?: LearnedRule[];
  /** manual/voice entry cash maani jaye ya nahi (default: cash) */
  defaultPaidWith?: PaidWith;
}
