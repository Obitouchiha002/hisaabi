import { describe, expect, it } from 'vitest';
import { detectIntent, looksLikeTrip } from '../src/ask.js';
import { draftTripFromText, nextTripQuestion, tripDraftMessage, fillMembers } from '../src/trips.js';
import { extractAmount } from '../src/numbers.js';
import { toPaise } from '../src/money.js';

const helpers = { extractAmount };

describe('detectIntent — user ko button sochna na pade', () => {
  it.each([
    ['chai bees auto saath', true, 'expense'],
    ['petrol 500 dala', true, 'expense'],
    ['salary mili 25000', true, 'expense'],
  ])('"%s" → kharcha', (text, hasAmount, expected) => {
    expect(detectIntent(text, hasAmount)).toBe(expected);
  });

  it.each([
    'is mahine kitna gaya',
    'swiggy pe kitna kharch hua?',
    'sabse bada kharcha kaunsa tha',
    'aaj kitna bacha hai',
  ])('"%s" → sawaal', (text) => {
    expect(detectIntent(text, false)).toBe('question');
  });

  it('amount ke saath bhi sawaal sawaal hi rehta hai', () => {
    expect(detectIntent('500 se zyada kaunse kharche the?', true)).toBe('question');
  });

  it.each([
    '4 dost Goa ja rahe hain',
    'hum paanch log Manali ghumne jaa rahe hain',
    'Rahul Aman ke saath party plan hai',
  ])('"%s" → trip', (text) => {
    expect(detectIntent(text, false)).toBe('trip');
  });

  it('sirf "trip" bolne se trip nahi banta — log bhi chahiye', () => {
    expect(looksLikeTrip('trip ka kharcha 500')).toBe(false);
  });
});

describe('draftTripFromText', () => {
  it('jagah, log aur budget — teeno nikaal leta hai', () => {
    const d = draftTripFromText('4 dost Goa ja rahe hain budget das hazaar', helpers);

    expect(d.name).toBe('Goa');
    expect(d.emoji).toBe('🏖️');
    expect(d.memberCount).toBe(4);
    expect(d.budgetPaise).toBe(toPaise(10000));
    expect(nextTripQuestion(d)).toBeNull();   // sab mil gaya, kuch poochna nahi
  });

  it('ginti aur "log" jagah ke naam me nahi ghuste', () => {
    expect(draftTripFromText('hum paanch log Manali ghumne jaa rahe hain', helpers).name).toBe('Manali');
  });

  it('jo na mile wahi poochta hai — ek waqt me ek', () => {
    const d = draftTripFromText('Rahul Aman ke saath party plan hai', helpers);
    expect(d.memberNames).toEqual(['Rahul', 'Aman']);
    expect(nextTripQuestion(d)).toMatch(/kahan/i);
  });

  it('message me pehle samjhi hui baat, phir sawaal', () => {
    const d = draftTripFromText('hum paanch log Manali ghumne jaa rahe hain', helpers);
    const msg = tripDraftMessage(d);

    expect(msg).toContain('Manali');
    expect(msg).toContain('5 log');
    expect(msg).toMatch(/budget/i);
  });

  it('naam na pata ho to bhi ginti se members ban jate hain', () => {
    const d = draftTripFromText('4 dost Goa ja rahe hain', helpers);
    const members = fillMembers(d, 'Vansh');

    expect(members).toHaveLength(4);
    expect(members[0]!.name).toBe('Vansh');
    expect(members[3]!.name).toBe('Dost 3');
  });
});
