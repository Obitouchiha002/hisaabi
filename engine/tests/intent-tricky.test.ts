import { describe, expect, it } from 'vitest';
import { detectIntent } from '../src/ask.js';
import { parseText } from '../src/parse.js';

const intent = (t: string) => detectIntent(t, parseText(t).length > 0);

const CASES: Array<[string, string]> = [
  ['goa ja rahe hain 4 log', 'trip'],
  ['manali trip bana do rahul aman aur me', 'trip'],
  ['dosto ke saath shimla plan hai budget 20000', 'trip'],
  ['hum 5 log rishikesh ja rahe hain 15000 ka budget', 'trip'],
  ['bhai log goa chalte hain', 'trip'],
  ['trip banao', 'trip'],
  ['rahul aman ke saath goa ja rahe hain', 'trip'],

  ['chai 20', 'expense'],
  ['auto chalis ka', 'expense'],
  ['2 chai 20 ki 3 samose 15 ke', 'expense'],
  ['petrol 2000 diya 1500 udhaar', 'expense'],
  ['aaj subah chai 20 dopahar khana 120 shaam auto 60', 'expense'],
  ['mummy ne 500 diye', 'expense'],
  ['goa me hotel 3000 diya', 'expense'],
  ['ghar jaane ka ticket 850', 'expense'],
  ['office se ghar aane me auto 60', 'expense'],

  ['is mahine kitna gaya', 'question'],
  ['sabse bada kharcha kya tha', 'question'],
  ['aaj kitna kharch hua', 'question'],
  ['khane pe kitna gaya is hafte', 'question'],
  ['kitna bacha hai', 'question'],
  ['goa trip me kitna laga', 'question'],
];

describe('intent — tricky sawaal', () => {
  for (const [text, want] of CASES) {
    it(`${want.padEnd(8)} ← ${text}`, () => expect(intent(text)).toBe(want));
  }
});
