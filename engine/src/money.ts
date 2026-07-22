import type { Paise } from './types.js';

/** ₹20.5 → 2050 paise */
export function toPaise(rupees: number): Paise {
  return Math.round(rupees * 100);
}

/** 2050 → 20.5 */
export function toRupees(paise: Paise): number {
  return paise / 100;
}

/**
 * Indian grouping ke saath format: 1234567 paise → "₹12,345.67"
 * Poore rupee ho to decimal nahi dikhate: 2000 → "₹20"
 */
export function formatINR(paise: Paise, opts: { symbol?: boolean } = {}): string {
  const symbol = opts.symbol === false ? '' : '₹';
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rem = abs % 100;

  const grouped = groupIndian(rupees);
  const decimals = rem === 0 ? '' : '.' + String(rem).padStart(2, '0');
  return `${negative ? '-' : ''}${symbol}${grouped}${decimals}`;
}

/** 1234567 → "12,34,567" (lakh/crore grouping) */
export function groupIndian(n: number): string {
  const s = String(n);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
}

/** "₹3,240" jaisa chhota label — reports/chips ke liye */
export function formatShort(paise: Paise): string {
  const rupees = Math.round(paise / 100);
  if (rupees >= 10000000) return `₹${(rupees / 10000000).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `₹${rupees}`;
}
