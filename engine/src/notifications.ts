/**
 * UPI / bank notification → DraftEntry.
 *
 * NIYAM: notification ka text KABHI AI ko nahi jata. Usme OTP, balance aur
 * account number ho sakte hain. Ye poora parser sirf regex hai, aur phone ke
 * andar hi chalta hai.
 */

import type { DraftEntry, DraftWarning, EntryType, RawEvent } from './types.js';
import { scrubPII, titleCase } from './normalize.js';
import { toPaise } from './money.js';

/** Android package → app ka naam */
const APP_NAMES: Record<string, string> = {
  'com.phonepe.app': 'PhonePe',
  'com.google.android.apps.nbu.paisa.user': 'GPay',
  'net.one97.paytm': 'Paytm',
  'in.org.npci.upiapp': 'BHIM',
  'com.dreamplug.androidapp': 'CRED',
  'com.google.android.apps.messaging': 'SMS',
  'com.samsung.android.messaging': 'SMS',
  'com.whatsapp': 'WhatsApp',
  'com.amazon.mShop.android.shopping': 'Amazon',
  'com.mobikwik_new': 'MobiKwik',
  'com.freecharge.android': 'Freecharge',
};

/** Ye notifications kabhi entry nahi bante. */
const IGNORE_RE = new RegExp(
  [
    '\\botp\\b', 'one[- ]time password', 'do not share', 'kabhi share',
    'available balance', 'balance is', 'bal:', 'a/c balance',
    'due (?:on|date)', 'payment reminder', 'reminder', 'auto[- ]?pay set',
    'cashback (?:up ?to|offer)', '\\boffer\\b', 'win \\b', 'flat \\d+% off',
    'has requested', 'requesting', 'collect request', 'payment request',
    'is your', 'verification code', 'login attempt',
  ].join('|'),
  'i',
);

/** Kharcha */
const DEBIT_RE = /\b(debited|debit|paid|payment of|sent|spent|purchase|deducted|withdrawn|dr\b)\b/i;

// Failed/declined transaction — ledger me daalna hi galat hai (paisa gaya hi nahi).
const FAILED_RE = /\b(failed|declined|unsuccessful|not\s+(?:processed|completed)|couldn'?t be)\b/i;
// Paisa wapas aaya — kharche ko ghatata hai, income nahi.
const REFUND_RE = /\b(refund(?:ed)?|reversed|reversal|cashback|money\s*back)\b/i;
// Apne hi paise ka idhar-udhar — na kharcha na kamai (double-count se bachao).
const TRANSFER_RE = /\b(added to (?:your )?(?:paytm |amazon |phonepe )?wallet|wallet (?:top-?up|load(?:ed)?)|credit card bill|card bill paid|to your own account|self[- ]?transfer)\b/i;
/** Aamdani / wapas */
const CREDIT_RE = /\b(credited|credit|received|refund(?:ed)?|added to|cr\b)\b/i;

/** Notification me amount ke saath currency hona zaroori hai, warna har number amount ban jayega. */
const AMOUNT_RE = /(?:₹|rs\.?|inr\.?)\s*(\d[\d,]*(?:\.\d{1,2})?)/i;

const MERCHANT_PATTERNS: RegExp[] = [
  /\b(?:paid|sent|payment)\s+to\s+([A-Za-z0-9 &'’.\-]{2,40}?)(?=\s+(?:via|using|on|from|ref|through|at)\b|[.,!\n]|$)/i,
  /\bto\s+([A-Za-z0-9 &'’.\-]{2,40}?)(?=\s+(?:via|using|on|from|ref|through)\b|[.,!\n]|$)/i,
  /\b(?:at|towards)\s+([A-Za-z0-9 &'’.\-]{2,40}?)(?=\s+(?:via|using|on|from|ref)\b|[.,!\n]|$)/i,
  /\bfrom\s+([A-Za-z0-9 &'’.\-]{2,40}?)(?=\s+(?:via|using|on|to|ref)\b|[.,!\n]|$)/i,
];

const REF_RE = /\b(?:ref(?:erence)?|txn|upi(?:\s*ref)?|utr)\s*(?:no\.?|id|#)?[:\s-]*([A-Za-z0-9]{6,})/i;

export interface NotificationParseOptions {
  now?: Date;
}

export function parseNotification(event: RawEvent, opts: NotificationParseOptions = {}): DraftEntry | null {
  const rawParts = [event.meta?.title, event.meta?.body, event.rawText].filter(Boolean) as string[];
  const raw = rawParts.join(' — ');
  if (!raw.trim()) return null;

  if (IGNORE_RE.test(raw)) return null;

  const amountMatch = raw.match(AMOUNT_RE);
  if (!amountMatch?.[1]) return null;

  const value = parseFloat(amountMatch[1].replace(/,/g, ''));
  if (!isFinite(value) || value <= 0) return null;

  // Failed/declined — paisa gaya hi nahi, ledger me daalna galat.
  if (FAILED_RE.test(raw)) return null;

  const isRefund = REFUND_RE.test(raw);
  const isTransfer = TRANSFER_RE.test(raw);
  const isCredit = CREDIT_RE.test(raw);
  const isDebit = DEBIT_RE.test(raw);
  if (!isCredit && !isDebit && !isTransfer) return null; // direction hi nahi pata → chhod do

  // refund kharche ko ghatata hai; transfer apne hi paise ka move — dono income/expense nahi.
  const type: EntryType = isTransfer
    ? 'transfer'
    : isRefund
      ? 'refund'
      : isCredit && !isDebit
        ? 'income'
        : 'expense';

  const warnings: DraftWarning[] = [];
  const merchant = extractMerchant(raw);
  if (!merchant) warnings.push('merchant_unknown');

  const sourceApp =
    (event.meta?.packageName && APP_NAMES[event.meta.packageName]) ||
    event.meta?.appLabel ||
    undefined;

  const refMatch = raw.match(REF_RE);

  let confidence = 0.72;
  if (merchant) confidence += 0.14;
  if (sourceApp) confidence += 0.06;
  if (refMatch) confidence += 0.05;

  return {
    title: merchant
      ? titleCase(merchant)
      : type === 'refund'
        ? 'Refund'
        : type === 'transfer'
          ? 'Transfer'
          : type === 'income'
            ? 'Paisa aaya'
            : 'Kharcha',
    amountPaise: toPaise(value),
    type,
    paidWith: 'digital',
    occurredAt: (opts.now ?? new Date(event.receivedAt)).toISOString(),
    source: 'notification',
    merchant: merchant ? titleCase(merchant) : undefined,
    confidence: Math.min(0.97, Math.round(confidence * 100) / 100),
    warnings,
    rawEventId: event.id,
    rawEventIds: [event.id],
    ref: refMatch?.[1],
    sourceApp,
    note: scrubPII(raw).slice(0, 160),
  };
}

function extractMerchant(raw: string): string | undefined {
  for (const re of MERCHANT_PATTERNS) {
    const m = raw.match(re);
    const name = m?.[1]?.trim();
    if (name && !looksLikeNoise(name)) return tidyMerchant(name);
  }

  // UPI VPA: blinkit@ybl → Blinkit
  const vpa = raw.match(/\b([a-z0-9][\w.\-]{2,})@[a-z]{2,}\b/i);
  if (vpa?.[1] && !/^\d+$/.test(vpa[1])) return tidyMerchant(vpa[1].replace(/[.\-_]/g, ' '));

  return undefined;
}

function looksLikeNoise(name: string): boolean {
  const n = name.toLowerCase().trim();
  if (n.length < 2) return true;
  if (/^\d+$/.test(n)) return true;
  return /^(you|your|a\/c|account|bank|upi|the|your account|self)$/.test(n);
}

function tidyMerchant(name: string): string {
  return name
    .replace(/\b(pvt|private|ltd|limited)\b\.?/gi, '')
    .replace(/[^\p{L}\p{N}\s&'.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 4)
    .join(' ');
}
