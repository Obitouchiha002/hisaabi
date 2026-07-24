/**
 * Engine ke Hinglish labels ko app ki bhasha me badalta hai.
 *
 * Engine jaan-boojh kar Hinglish rakhta hai — wahi text AI aur notifications me
 * bhi jata hai, aur user Hinglish hi bolta hai. Par UI English ho sakti hai,
 * isliye dikhane se pehle yahan tarjuma ho jata hai.
 */

import { categoryMeta, type CategoryId, type EntryType } from '@engine';
import { t } from './i18n';

const CAT_EN: Record<CategoryId, string> = {
  food: 'Food & drink',
  grocery: 'Groceries',
  travel: 'Travel',
  bills: 'Bills & recharge',
  shopping: 'Shopping',
  health: 'Health',
  rent: 'Rent',
  education: 'Education',
  fun: 'Fun',
  other: 'Other',
  income: 'Income',
};

/** Category ka naam abhi ki bhasha me. */
export function catLabel(id: CategoryId): string {
  return t(CAT_EN[id] ?? id, categoryMeta(id).label);
}

/** Category ka emoji (bhasha se farq nahi padta). */
export function catEmoji(id: CategoryId): string {
  return categoryMeta(id).emoji;
}

/**
 * Entry ke neeche wali chhoti line — "To collect", "Withdrew cash", etc.
 * Kharcha ho to category ka naam.
 */
export function entrySubtitle(type: EntryType, categoryId: CategoryId): string {
  switch (type) {
    case 'lent': return t('To collect', 'Lena hai');
    case 'borrowed': return t('To pay back', 'Dena hai');
    case 'cash_in': return t('Cash withdrawn', 'Cash nikala');
    case 'income': return t('Income', 'Aamdani');
    default: return catLabel(categoryId);
  }
}
