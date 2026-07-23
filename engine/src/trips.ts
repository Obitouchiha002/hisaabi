/**
 * Trip / dosto ka hisaab.
 *
 * "5 dost, Goa gaye, petrol maine diya, khana Rahul ne, hotel aadha-aadha" —
 * aakhir me sirf ek sawaal bachta hai: **kaun kisko kitna de?**
 *
 * Wahi jawab yahan banta hai. AI sirf line samajhne me madad karta hai
 * (kisne diya, kaise banta); jod-ghata aur settlement poora deterministic hai.
 */

import type { CategoryId, Paise } from './types.js';
import { isNumberWord } from './numbers.js';

export interface TripMember {
  id: string;
  name: string;
}

export type SplitMode =
  | 'equal'    // sabme barabar
  | 'shares'   // hisse ke hisaab se (2 log ek kamre me = 2 share)
  | 'exact';   // kis pe kitna, khud likha hua

export interface TripExpense {
  id: string;
  title: string;
  amountPaise: Paise;
  /** kisne diye */
  paidBy: string;
  splitMode: SplitMode;
  /** equal: kin logon me (khaali = sab) · shares: {id: weight} · exact: {id: paise} */
  splitWith?: string[];
  shares?: Record<string, number>;
  exact?: Record<string, Paise>;
  category?: CategoryId;
  occurredAt: string;
  note?: string;
}

export interface Trip {
  id: string;
  name: string;
  emoji: string;
  members: TripMember[];
  expenses: TripExpense[];
  createdAt: string;
  status: 'open' | 'settled';
  /** socha hua budget — trip meter isi se banta hai */
  budgetPaise?: Paise;
  note?: string;
}

export interface MemberBalance {
  member: TripMember;
  /** isne kul kitna diya */
  paidPaise: Paise;
  /** iske hisse me kitna aaya */
  owesPaise: Paise;
  /** + matlab isko wapas milna hai, − matlab isne dena hai */
  netPaise: Paise;
}

export interface Transfer {
  from: TripMember;
  to: TripMember;
  amountPaise: Paise;
}

export interface TripSummary {
  totalPaise: Paise;
  perHeadPaise: Paise;
  balances: MemberBalance[];
  /** sabse kam len-den me hisaab barabar */
  transfers: Transfer[];
  expenseCount: number;
}

/**
 * Ek kharche ka hissa har member pe.
 *
 * Rounding ka dhyan: 100 ko 3 me baanto to 33.33 aata hai. Agar har kisi ko
 * 33 de diya to 1 paisa gayab. Isliye bacha hua paisa ek-ek karke baant dete
 * hain — total hamesha exact match karta hai.
 */
export function splitExpense(expense: TripExpense, members: TripMember[]): Record<string, Paise> {
  const ids = members.map((m) => m.id);
  const out: Record<string, Paise> = {};

  if (expense.splitMode === 'exact' && expense.exact) {
    for (const id of ids) out[id] = expense.exact[id] ?? 0;
    return out;
  }

  if (expense.splitMode === 'shares' && expense.shares) {
    const totalShares = Object.values(expense.shares).reduce((s, v) => s + Math.max(0, v), 0);
    if (totalShares <= 0) return equalSplit(expense.amountPaise, ids, out);

    let given = 0;
    const holders = ids.filter((id) => (expense.shares![id] ?? 0) > 0);

    holders.forEach((id, i) => {
      if (i === holders.length - 1) {
        out[id] = expense.amountPaise - given;   // aakhri wale ko bacha hua, taki total exact rahe
      } else {
        const part = Math.floor((expense.amountPaise * (expense.shares![id] ?? 0)) / totalShares);
        out[id] = part;
        given += part;
      }
    });

    for (const id of ids) out[id] = out[id] ?? 0;
    return out;
  }

  const among = expense.splitWith?.length ? expense.splitWith : ids;
  return equalSplit(expense.amountPaise, among, out, ids);
}

function equalSplit(
  amount: Paise,
  among: string[],
  out: Record<string, Paise>,
  allIds: string[] = among,
): Record<string, Paise> {
  for (const id of allIds) out[id] = 0;
  if (!among.length) return out;

  const base = Math.floor(amount / among.length);
  let remainder = amount - base * among.length;

  for (const id of among) {
    out[id] = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
  }

  return out;
}

/** Poore trip ka hisaab — kisne kitna diya, kiske hisse me kitna aaya. */
export function tripBalances(trip: Trip): MemberBalance[] {
  const paid = new Map<string, Paise>();
  const owes = new Map<string, Paise>();

  for (const m of trip.members) {
    paid.set(m.id, 0);
    owes.set(m.id, 0);
  }

  for (const expense of trip.expenses) {
    paid.set(expense.paidBy, (paid.get(expense.paidBy) ?? 0) + expense.amountPaise);

    const split = splitExpense(expense, trip.members);
    for (const [id, share] of Object.entries(split)) {
      owes.set(id, (owes.get(id) ?? 0) + share);
    }
  }

  return trip.members.map((member) => {
    const p = paid.get(member.id) ?? 0;
    const o = owes.get(member.id) ?? 0;
    return { member, paidPaise: p, owesPaise: o, netPaise: p - o };
  });
}

/**
 * Sabse kam len-den me hisaab barabar.
 *
 * Sabse zyada dena wala sabse zyada lena wale ko deta hai. Isse 5 dost ka
 * hisaab aksar 2-3 transfer me nipat jata hai, 20 me nahi.
 */
export function settleUp(balances: MemberBalance[]): Transfer[] {
  const debtors = balances
    .filter((b) => b.netPaise < 0)
    .map((b) => ({ member: b.member, amount: -b.netPaise }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = balances
    .filter((b) => b.netPaise > 0)
    .map((b) => ({ member: b.member, amount: b.netPaise }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]!;
    const creditor = creditors[j]!;
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0) {
      transfers.push({ from: debtor.member, to: creditor.member, amountPaise: amount });
      debtor.amount -= amount;
      creditor.amount -= amount;
    }

    if (debtor.amount === 0) i += 1;
    if (creditor.amount === 0) j += 1;
  }

  return transfers;
}

export function tripSummary(trip: Trip): TripSummary {
  const balances = tripBalances(trip);
  const total = trip.expenses.reduce((s, e) => s + e.amountPaise, 0);

  return {
    totalPaise: total,
    perHeadPaise: trip.members.length ? Math.round(total / trip.members.length) : 0,
    balances,
    transfers: settleUp(balances),
    expenseCount: trip.expenses.length,
  };
}

/** "Rahul ko ₹450 dene hain" jaisi line. */
export function transferLine(t: Transfer, format: (p: Paise) => string): string {
  return `${t.from.name} → ${t.to.name} · ${format(t.amountPaise)}`;
}

/* ============================================================
   Trip khatam hone pe: khitab, kahani, aur WhatsApp pe bhejne layak summary.
   Ye sab bhi deterministic hai — AI se koi number nahi aata.
   ============================================================ */

export interface TripAward {
  id: string;
  emoji: string;
  title: string;
  member: TripMember;
  detail: string;
}

export interface TripStory {
  totalPaise: Paise;
  perHeadPaise: Paise;
  days: number;
  biggestDay: { date: string; paise: Paise } | null;
  biggestExpense: TripExpense | null;
  byCategory: Array<{ id: CategoryId; paise: Paise }>;
  awards: TripAward[];
}

/** Har din ka kharcha — timeline ke liye. */
export function tripByDay(trip: Trip): Array<{ date: string; paise: Paise; expenses: TripExpense[] }> {
  const map = new Map<string, { date: string; paise: Paise; expenses: TripExpense[] }>();

  for (const e of trip.expenses) {
    const date = e.occurredAt.slice(0, 10);
    const row = map.get(date) ?? { date, paise: 0, expenses: [] };
    row.paise += e.amountPaise;
    row.expenses.push(e);
    map.set(date, row);
  }

  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Khitab. Sab asli data se nikalte hain — jhoothi tareef nahi.
 * Trip khaali ho to koi khitab nahi milta.
 */
export function tripAwards(trip: Trip): TripAward[] {
  if (!trip.expenses.length || !trip.members.length) return [];

  const balances = tripBalances(trip);
  const awards: TripAward[] = [];

  const atm = [...balances].sort((a, b) => b.paidPaise - a.paidPaise)[0];
  if (atm && atm.paidPaise > 0) {
    awards.push({
      id: 'atm', emoji: '🏧', title: 'Trip ka ATM',
      member: atm.member, detail: `Sabse zyada jeb dhili ki — ${paise(atm.paidPaise)}`,
    });
  }

  const saver = [...balances].sort((a, b) => a.owesPaise - b.owesPaise)[0];
  if (saver && balances.length > 1) {
    awards.push({
      id: 'saver', emoji: '🪙', title: 'Budget bachane wala',
      member: saver.member, detail: `Sabse kam hissa — ${paise(saver.owesPaise)}`,
    });
  }

  const foodie = topSpenderIn(trip, 'food');
  if (foodie) {
    awards.push({
      id: 'foodie', emoji: '🍕', title: 'Sabse bada foodie',
      member: foodie.member, detail: `Khane pe ${paise(foodie.paise)} udaye`,
    });
  }

  const shopper = topSpenderIn(trip, 'shopping');
  if (shopper) {
    awards.push({
      id: 'shopper', emoji: '🛍️', title: 'Shopping king/queen',
      member: shopper.member, detail: `Shopping me ${paise(shopper.paise)}`,
    });
  }

  const freeloader = balances.find((b) => b.paidPaise === 0 && b.owesPaise > 0);
  if (freeloader && balances.length > 2) {
    awards.push({
      id: 'free', emoji: '😇', title: 'Free ka traveller',
      member: freeloader.member, detail: 'Ek baar bhi jeb nahi nikali',
    });
  }

  return awards;
}

function topSpenderIn(trip: Trip, category: CategoryId): { member: TripMember; paise: Paise } | null {
  const totals = new Map<string, Paise>();

  for (const e of trip.expenses) {
    if (e.category !== category) continue;
    totals.set(e.paidBy, (totals.get(e.paidBy) ?? 0) + e.amountPaise);
  }

  let best: { member: TripMember; paise: Paise } | null = null;
  for (const [id, amount] of totals) {
    const member = trip.members.find((m) => m.id === id);
    if (member && amount > (best?.paise ?? 0)) best = { member, paise: amount };
  }
  return best;
}

export function tripStory(trip: Trip): TripStory {
  const days = tripByDay(trip);
  const total = trip.expenses.reduce((s, e) => s + e.amountPaise, 0);

  const byCategory = new Map<CategoryId, Paise>();
  for (const e of trip.expenses) {
    const id = (e.category ?? 'other') as CategoryId;
    byCategory.set(id, (byCategory.get(id) ?? 0) + e.amountPaise);
  }

  return {
    totalPaise: total,
    perHeadPaise: trip.members.length ? Math.round(total / trip.members.length) : 0,
    days: days.length,
    biggestDay: days.length ? days.reduce((a, b) => (b.paise > a.paise ? b : a)) : null,
    biggestExpense: trip.expenses.length
      ? trip.expenses.reduce((a, b) => (b.amountPaise > a.amountPaise ? b : a))
      : null,
    byCategory: [...byCategory.entries()]
      .map(([id, p]) => ({ id, paise: p }))
      .sort((a, b) => b.paise - a.paise),
    awards: tripAwards(trip),
  };
}

/**
 * WhatsApp pe chipkane layak summary.
 *
 * Dost group me rehte hain, app me nahi — isliye invite ke bajaye seedha
 * message. Ye aaj kaam karta hai, bina kisi server ke.
 */
export function tripShareText(trip: Trip, format: (p: Paise) => string = paise): string {
  const summary = tripSummary(trip);
  const lines: string[] = [];

  lines.push(`${trip.emoji} *${trip.name}* — hisaab`);
  lines.push('');
  lines.push(`Kul kharcha: ${format(summary.totalPaise)}`);
  lines.push(`Har banda: ${format(summary.perHeadPaise)}`);
  lines.push('');

  lines.push('*Kisne kitna diya*');
  for (const b of summary.balances) {
    lines.push(`• ${b.member.name}: ${format(b.paidPaise)}`);
  }

  if (summary.transfers.length) {
    lines.push('');
    lines.push('*Ab hisaab barabar karne ke liye*');
    for (const t of summary.transfers) {
      lines.push(`• ${t.from.name} → ${t.to.name}: ${format(t.amountPaise)}`);
    }
  } else {
    lines.push('');
    lines.push('Hisaab pehle se barabar hai ✅');
  }

  const awards = tripAwards(trip);
  if (awards.length) {
    lines.push('');
    lines.push('*Khitab*');
    for (const a of awards) lines.push(`${a.emoji} ${a.title} — ${a.member.name}`);
  }

  lines.push('');
  lines.push('— Hisaabi se');
  return lines.join('\n');
}

function paise(value: Paise): string {
  return '₹' + Math.round(value / 100).toLocaleString('en-IN');
}

/* ============================================================
   Bol ke trip banana — "4 dost Goa ja rahe hain, budget das hazaar"
   ============================================================ */

/** AI ya rules se nikla hua trip ka khaka. Kuch cheezein missing ho sakti hain. */
export interface TripDraft {
  name?: string;
  emoji?: string;
  /** naam jo mile — "Rahul, Aman" */
  memberNames: string[];
  /** kitne log bole gaye ("4 dost") — naam na pata ho to bhi count aata hai */
  memberCount?: number;
  budgetPaise?: Paise;
  /** kya-kya poochna baaki hai */
  missing: Array<'name' | 'members' | 'budget'>;
}

/** Jaani-pehchani jagah — inka emoji apne aap lag jata hai. */
const PLACE_EMOJI: Array<[RegExp, string]> = [
  [/\b(goa|beach|samundar|puri|andaman)\b/i, '🏖️'],
  [/\b(manali|shimla|kashmir|pahad|mountain|leh|ladakh|spiti|mussoorie|nainital)\b/i, '🏔️'],
  [/\b(party|birthday|bday)\b/i, '🎉'],
  [/\b(daaru|beer|bar|club)\b/i, '🍻'],
  [/\b(road ?trip|bike|car|gaadi)\b/i, '🚗'],
  [/\b(flight|udan|dubai|thailand|bali|videsh)\b/i, '✈️'],
  [/\b(camp|trek|jungle)\b/i, '🏕️'],
  [/\b(movie|film|cinema)\b/i, '🎬'],
  [/\b(match|cricket|stadium)\b/i, '🏏'],
];

/** Jaha ja rahe hain — "goa ja rahe hain" me se "Goa". */
const DESTINATION_RE =
  /\b(?:for |ke liye |)([A-Za-z][A-Za-z\s]{2,20}?)\s+(?:ja rahe|jaa rahe|jaana|jayenge|jaayenge|ki trip|ka trip|trip pe|trip par|ghumne|ghoomne)/i;

/** "4 dost", "paanch log", "hum teen" */
const COUNT_RE = /\b(\d{1,2}|ek|do|teen|char|chaar|panch|paanch|chhe|saat|aath|nau|das)\s*(?:dost|dosto|doston|log|logon|yaar|banda|bande|jane|friends|people)\b/i;

const COUNT_WORDS: Record<string, number> = {
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, panch: 5, paanch: 5,
  chhe: 6, saat: 7, aath: 8, nau: 9, das: 10,
};

/** "budget das hazaar", "bees hazaar ka budget" */
const BUDGET_RE = /\b(?:budget|bajat)\b/i;

/**
 * Text se trip ka khaka nikalo — rules se.
 * Jo na mile wo `missing` me aata hai, taki app wahi poochh sake.
 */
export function draftTripFromText(
  text: string,
  helpers: { extractAmount(t: string): { value: number } | null },
): TripDraft {
  const draft: TripDraft = { memberNames: [], missing: [] };

  const dest = text.match(DESTINATION_RE);
  if (dest?.[1]) {
    // "4 dost Goa" me se sirf "Goa" chahiye — log/dost/hum jagah ka naam nahi hain
    const NOT_A_PLACE = /^(dost|dosto|doston|log|logon|yaar|yaaron|hum|humlog|hamlog|banda|bande|jane|friends|people|sab|sabhi|apne|mere|ham|ke|ki|ka|saath|liye)$/i;

    const words = dest[1]
      .trim()
      .split(/\s+/)
      // ginti bhi jagah ka naam nahi hai — "paanch log Manali" me sirf Manali
      .filter((w) => !NOT_A_PLACE.test(w) && !/^\d+$/.test(w) && !isNumberWord(w));

    const name = words.slice(-2).join(' ').trim();
    if (name) {
      draft.name = name
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
  }

  for (const [re, emoji] of PLACE_EMOJI) {
    if (re.test(text)) { draft.emoji = emoji; break; }
  }

  const count = text.match(COUNT_RE);
  if (count?.[1]) {
    const raw = count[1].toLowerCase();
    const n = /^\d+$/.test(raw) ? parseInt(raw, 10) : COUNT_WORDS[raw];
    if (n && n >= 2 && n <= 30) draft.memberCount = n;
  }

  // Bade akshar wale naam — "Rahul Aman ke saath"
  const names = text.match(/\b[A-Z][a-z]{2,12}\b/g) ?? [];
  draft.memberNames = names
    .filter((n) => !/^(Goa|Manali|Shimla|Kashmir|Delhi|Mumbai|Trip|Budget)$/i.test(n))
    .slice(0, 12);

  if (BUDGET_RE.test(text)) {
    const after = text.slice(text.search(BUDGET_RE));
    const amount = helpers.extractAmount(after) ?? helpers.extractAmount(text);
    if (amount && amount.value >= 100) draft.budgetPaise = Math.round(amount.value * 100);
  }

  if (!draft.name) draft.missing.push('name');
  if (!draft.memberCount && draft.memberNames.length < 2) draft.missing.push('members');
  if (!draft.budgetPaise) draft.missing.push('budget');

  return draft;
}

/**
 * App ko kya poochna chahiye — ek waqt me ek hi sawaal, warna form jaisa lagta hai.
 */
export function nextTripQuestion(draft: TripDraft): string | null {
  if (draft.missing.includes('name')) return 'Kahan ja rahe ho?';
  if (draft.missing.includes('members')) return 'Kaun-kaun ja raha hai? Naam bata do.';
  if (draft.missing.includes('budget')) return 'Kitne ka budget socha hai? (chhod bhi sakte ho)';
  return null;
}

/**
 * User ko dikhane wali line — pehle ye batao ki kya samjha, phir jo baaki hai wo poocho.
 * Form jaisa nahi lagna chahiye; dost ki tarah baat honi chahiye.
 */
export function tripDraftMessage(draft: TripDraft, format: (p: Paise) => string = paise): string {
  const samjha: string[] = [];

  if (draft.name) samjha.push(`${draft.emoji ?? '🧳'} ${draft.name}`);
  if (draft.memberCount) samjha.push(`${draft.memberCount} log`);
  else if (draft.memberNames.length >= 2) samjha.push(draft.memberNames.join(', '));
  if (draft.budgetPaise) samjha.push(`${format(draft.budgetPaise)} ka budget`);

  if (!samjha.length) return 'Trip ka plan lag raha hai! Thoda aur batao —';

  const head = `Mast plan hai! ${samjha.join(' · ')}`;
  const question = nextTripQuestion(draft);

  return question ? `${head}\n\nBas ek cheez — ${question.toLowerCase()}` : `${head}\n\nBana doon?`;
}

/** Count pata ho par naam nahi — "Dost 2", "Dost 3" jaise placeholder. */
export function fillMembers(draft: TripDraft, myName = 'Main'): TripMember[] {
  const names = [...draft.memberNames];
  const total = Math.max(draft.memberCount ?? names.length, names.length);

  if (!names.length) names.push(myName);
  while (names.length < total) names.push(`Dost ${names.length}`);

  return names.map((name, i) => ({
    id: `m${i}_${name.toLowerCase().replace(/\W/g, '')}`,
    name,
  }));
}
