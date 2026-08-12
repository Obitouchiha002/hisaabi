import { describe, expect, it } from 'vitest';
import { parseNotification } from '../src/notifications.js';
import { scrubPII } from '../src/normalize.js';
import type { RawEvent } from '../src/types.js';

function ev(text: string, packageName?: string): RawEvent {
  return {
    id: 'raw_1',
    source: 'notification',
    rawText: text,
    receivedAt: '2026-07-22T20:05:00.000Z',
    meta: packageName ? { packageName } : undefined,
  };
}

describe('parseNotification', () => {
  it('PhonePe ka payment padhta hai', () => {
    const draft = parseNotification(ev('Rs.240 paid to Blinkit via PhonePe', 'com.phonepe.app'));

    expect(draft).toMatchObject({
      amountPaise: 24000,
      type: 'expense',
      merchant: 'Blinkit',
      sourceApp: 'PhonePe',
      paidWith: 'digital',
    });
  });

  it('bank SMS ka debit padhta hai (merchant na mile to bhi)', () => {
    const draft = parseNotification(
      ev('Your A/c XXXXXX1234 is debited by Rs.1200.00 on 22-07-26', 'com.google.android.apps.messaging'),
    );

    expect(draft?.amountPaise).toBe(120000);
    expect(draft?.type).toBe('expense');
    expect(draft?.warnings).toContain('merchant_unknown');
  });

  it('credit ko income maanta hai', () => {
    const draft = parseNotification(ev('Rs 2000 credited to your account from Vansh'));
    expect(draft?.type).toBe('income');
    expect(draft?.merchant).toBe('Vansh');
  });

  it('OTP ko chhoota bhi nahi', () => {
    expect(parseNotification(ev('123456 is your OTP for a txn of Rs 500. Do not share.'))).toBeNull();
  });

  it('payment request entry nahi banata', () => {
    expect(parseNotification(ev('Rahul has requested Rs 500 on PhonePe', 'com.phonepe.app'))).toBeNull();
  });

  it('offer/cashback ignore karta hai', () => {
    expect(parseNotification(ev('Get cashback up to Rs 100 on your next order'))).toBeNull();
  });

  it('currency ke bina number ko amount nahi maanta', () => {
    expect(parseNotification(ev('Order 12345 delivered, paid earlier'))).toBeNull();
  });

  it('direction hi na pata ho to chhod deta hai', () => {
    expect(parseNotification(ev('Your order of Rs 300 is on the way'))).toBeNull();
  });

  it('note me PII nahi bachta', () => {
    const draft = parseNotification(ev('Rs.500 debited to Kirana Store ref no ABC123456 A/c XXXXXX9876'));
    expect(draft?.note).not.toMatch(/9876|ABC123456/);
  });

  it('transaction ref pakadta hai (duplicate check ke liye)', () => {
    const draft = parseNotification(ev('Rs.240 paid to Blinkit. UPI Ref no 401234567890'));
    expect(draft?.ref).toBeTruthy();
  });

  it('failed transaction ledger me nahi jata (null)', () => {
    expect(parseNotification(ev('Your payment of Rs.500 to Blinkit failed'))).toBeNull();
    expect(parseNotification(ev('Transaction of Rs.500 was declined'))).toBeNull();
  });

  it('refund ko refund maanta hai, income nahi', () => {
    const draft = parseNotification(ev('Rs.200 refund credited for your Amazon order'));
    expect(draft?.type).toBe('refund');
  });

  it('cashback bhi refund hai', () => {
    const draft = parseNotification(ev('You received Rs.50 cashback'));
    expect(draft?.type).toBe('refund');
  });

  it('wallet me paisa daala to transfer (na kharcha na kamai)', () => {
    const draft = parseNotification(ev('Rs.1000 added to your Paytm wallet'));
    expect(draft?.type).toBe('transfer');
  });

  it('credit card bill payment transfer hai, kharcha nahi', () => {
    const draft = parseNotification(ev('Rs.5000 paid towards your credit card bill'));
    expect(draft?.type).toBe('transfer');
  });

  it('har draft me rawEventIds hota hai (merge ke liye)', () => {
    const draft = parseNotification(ev('Rs.240 paid to Blinkit'));
    expect(draft?.rawEventIds).toEqual(['raw_1']);
  });
});

describe('scrubPII', () => {
  it('account, card, otp, ref sab hata deta hai', () => {
    const dirty = 'A/c XXXXXX1234 card 4111 1111 1111 1111 otp is 445566 ref no ZX99881234 mob 9876543210';
    const clean = scrubPII(dirty);

    expect(clean).not.toMatch(/1234\b/);
    expect(clean).not.toMatch(/445566/);
    expect(clean).not.toMatch(/9876543210/);
  });

  it('VPA ka bank rakhta hai, naam chhupa deta hai', () => {
    expect(scrubPII('paid to vanshkashyap@okhdfcbank')).toContain('[vpa]@okhdfcbank');
  });
});
