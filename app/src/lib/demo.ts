/**
 * `?demo=1` — bina kuch save kiye bhari hui app dikhati hai.
 * Screenshot, demo aur testing ke liye. DB ko haath nahi lagati.
 */

import { toPaise, type Entry } from '@engine';
import type { Profile } from './profile';
import type { PendingItem } from './db';
import type { Trip } from '@engine';

export function isDemo(): boolean {
  return new URLSearchParams(location.search).has('demo');
}

export const DEMO_PROFILE: Profile = {
  name: 'Vansh',
  work: 'job',
  tone: 'dosti',
  address: 'bhai',
  monthlyBudgetPaise: toPaise(12000),
  defaultPaidWith: 'digital',
  discovery: 'instagram',
  createdAt: new Date().toISOString(),
};

function at(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 3600_000).toISOString();
}

function entry(over: Partial<Entry> & { title: string; amountPaise: number }): Entry {
  return {
    id: `demo_${over.title}_${over.amountPaise}`,
    type: 'expense',
    paidWith: 'cash',
    occurredAt: at(3),
    source: 'voice',
    confidence: 0.9,
    warnings: [],
    status: 'confirmed',
    createdAt: at(3),
    updatedAt: at(3),
    ...over,
  };
}

export const DEMO_ENTRIES: Entry[] = [
  entry({ title: 'Chai', amountPaise: toPaise(20), category: 'food', occurredAt: at(11) }),
  entry({ title: 'Auto', amountPaise: toPaise(60), category: 'travel', occurredAt: at(10) }),
  entry({ title: 'Sabzi', amountPaise: toPaise(140), category: 'grocery', occurredAt: at(9) }),
  entry({ title: 'Blinkit', merchant: 'Blinkit', amountPaise: toPaise(240), category: 'grocery',
          paidWith: 'digital', source: 'notification', sourceApp: 'PhonePe', occurredAt: at(4) }),
  entry({ title: 'Zomato', merchant: 'Zomato', amountPaise: toPaise(318), category: 'food',
          paidWith: 'digital', source: 'notification', sourceApp: 'GPay', occurredAt: at(2) }),
  entry({ title: 'ATM se nikala', amountPaise: toPaise(2000), type: 'cash_in', category: 'other',
          occurredAt: at(30) }),
  entry({ title: 'Jio recharge', merchant: 'Jio', amountPaise: toPaise(299), category: 'bills',
          paidWith: 'digital', source: 'notification', sourceApp: 'Paytm', occurredAt: at(52) }),
  entry({ title: 'Kiraya', amountPaise: toPaise(6500), category: 'rent',
          paidWith: 'digital', occurredAt: at(200) }),
  entry({ title: 'Rahul se lene hain', amountPaise: toPaise(500), type: 'lent',
          counterparty: 'Rahul', category: 'other', occurredAt: at(26) }),
  entry({ title: 'Aman ko dene hain', amountPaise: toPaise(300), type: 'borrowed',
          counterparty: 'Aman', category: 'other', occurredAt: at(20) }),
];

/** Review Inbox ka demo — ek saaf card, ek duplicate, ek shaq wala. */
export const DEMO_PENDING: PendingItem[] = [
  {
    id: 'pen_1',
    createdAt: at(1),
    preSelected: true,
    duplicates: [],
    draft: {
      title: 'Swiggy', merchant: 'Swiggy', amountPaise: toPaise(318), type: 'expense',
      paidWith: 'digital', occurredAt: at(1), source: 'notification', sourceApp: 'GPay',
      category: 'food', confidence: 0.92, warnings: [],
    },
  },
  {
    id: 'pen_2',
    createdAt: at(2),
    preSelected: false,
    duplicates: [{ entryId: 'demo_Blinkit_24000', score: 0.95, reasons: ['same amount', '3 min ke andar', 'same dukaan'] }],
    draft: {
      title: 'Blinkit', merchant: 'Blinkit', amountPaise: toPaise(240), type: 'expense',
      paidWith: 'digital', occurredAt: at(4), source: 'notification', sourceApp: 'SMS',
      category: 'grocery', confidence: 0.86, warnings: ['possible_duplicate'],
    },
  },
  {
    id: 'pen_3',
    createdAt: at(6),
    preSelected: false,
    duplicates: [],
    draft: {
      title: 'Kharcha', amountPaise: toPaise(1200), type: 'expense',
      paidWith: 'digital', occurredAt: at(6), source: 'notification', sourceApp: 'SMS',
      category: 'other', confidence: 0.52, warnings: ['merchant_unknown'],
    },
  },
];

/** Demo trip — Goa, 4 dost, hisaab baaki. */
export const DEMO_TRIPS: Trip[] = [{
  id: 'trip_demo',
  name: 'Goa',
  emoji: '🏖️',
  createdAt: at(72),
  status: 'open',
  budgetPaise: toPaise(15000),
  members: [
    { id: 'm0', name: 'Vansh' },
    { id: 'm1', name: 'Rahul' },
    { id: 'm2', name: 'Aman' },
    { id: 'm3', name: 'Sneha' },
  ],
  expenses: [
    { id: 'te1', title: 'Petrol', amountPaise: toPaise(2400), paidBy: 'm0', splitMode: 'equal', category: 'travel', occurredAt: at(70) },
    { id: 'te2', title: 'Hotel', amountPaise: toPaise(6000), paidBy: 'm1', splitMode: 'equal', category: 'rent', occurredAt: at(68) },
    { id: 'te3', title: 'Dinner', amountPaise: toPaise(2200), paidBy: 'm2', splitMode: 'equal', category: 'food', occurredAt: at(60) },
    { id: 'te4', title: 'Water sports', amountPaise: toPaise(3200), paidBy: 'm0', splitMode: 'equal', category: 'fun', occurredAt: at(50) },
    { id: 'te5', title: 'Nashta', amountPaise: toPaise(560), paidBy: 'm3', splitMode: 'equal', category: 'food', occurredAt: at(46) },
  ],
}];
