import { describe, expect, it, vi } from 'vitest';
import { HisaabiEngine } from '../src/index.js';
import { toPaise } from '../src/money.js';
import type { Entry, RawEvent } from '../src/types.js';

const NOW = new Date(2026, 6, 22, 20, 5, 0);

describe('HisaabiEngine — poora flow', () => {
  it('voice line → categorised drafts', async () => {
    const engine = new HisaabiEngine({ now: NOW });
    const drafts = await engine.ingestText('chai bees, auto saath, sabzi ek sau chalis', { source: 'voice' });

    expect(drafts.map((d) => [d.title, d.amountPaise, d.category])).toEqual([
      ['Chai', 2000, 'food'],
      ['Auto', 6000, 'travel'],
      ['Sabzi', 14000, 'grocery'],
    ]);
  });

  it('notification → draft, aur AI ko kabhi nahi bhejta', async () => {
    const ai = { parseEntries: vi.fn() };
    const engine = new HisaabiEngine({ now: NOW, ai });

    const event: RawEvent = {
      id: 'raw_1',
      source: 'notification',
      rawText: 'Rs.240 paid to Blinkit via PhonePe',
      receivedAt: NOW.toISOString(),
      meta: { packageName: 'com.phonepe.app' },
    };

    const draft = engine.ingestNotification(event);
    expect(draft).toMatchObject({ merchant: 'Blinkit', amountPaise: 24000, category: 'grocery' });
    expect(ai.parseEntries).not.toHaveBeenCalled();
  });

  it('voice + notification ka same transaction duplicate pakadta hai', async () => {
    const engine = new HisaabiEngine({ now: NOW });

    const confirmed: Entry[] = [{
      id: 'txn_1',
      title: 'Blinkit',
      merchant: 'Blinkit',
      amountPaise: toPaise(240),
      type: 'expense',
      paidWith: 'cash',
      occurredAt: new Date(2026, 6, 22, 20, 3).toISOString(),
      source: 'voice',
      confidence: 0.8,
      warnings: [],
      status: 'confirmed',
      createdAt: '', updatedAt: '',
    }];

    const draft = engine.ingestNotification({
      id: 'raw_2',
      source: 'notification',
      rawText: 'Rs.240 paid to Blinkit via PhonePe',
      receivedAt: new Date(2026, 6, 22, 20, 5).toISOString(),
      meta: { packageName: 'com.phonepe.app' },
    })!;

    const [item] = engine.review([draft], confirmed);

    expect(item?.duplicates).toHaveLength(1);
    expect(item?.draft.warnings).toContain('possible_duplicate');
    expect(item?.preSelected).toBe(false); // duplicate hai to auto-select kabhi nahi
  });

  it('साफ़ entry batch-confirm ke liye pre-selected hoti hai', async () => {
    const engine = new HisaabiEngine({ now: NOW });
    const draft = engine.ingestNotification({
      id: 'raw_3',
      source: 'notification',
      rawText: 'Rs.500 paid to Swiggy via GPay',
      receivedAt: NOW.toISOString(),
      meta: { packageName: 'com.google.android.apps.nbu.paisa.user' },
    })!;

    expect(engine.review([draft], [])[0]?.preSelected).toBe(true);
  });

  it('rules fail hon to hi AI bulata hai', async () => {
    const ai = {
      parseEntries: vi.fn().mockResolvedValue([
        { title: 'Kirana', amountPaise: 45000, type: 'expense', paidWith: 'cash', occurredAt: NOW.toISOString(), source: 'voice', confidence: 0.7, warnings: [] },
      ]),
    };
    const engine = new HisaabiEngine({ now: NOW, ai });

    // saaf line — rules kaafi hain, AI ka paisa nahi lagta
    await engine.ingestText('chai 20');
    expect(ai.parseEntries).not.toHaveBeenCalled();

    // "chai bees, auto saath" jaisi saaf line bhi rules hi karte hain
    await engine.ingestText('chai bees, auto saath');
    expect(ai.parseEntries).not.toHaveBeenCalled();

    // "bhaiya ko de diye" — udhaar hai ya kirane ka kharcha? Ye rules ka kaam nahi.
    await engine.ingestText('bhaiya ko chaar sau pachas de diye kirane ke');
    expect(ai.parseEntries).toHaveBeenCalledOnce();
    ai.parseEntries.mockClear();

    // yahan amount hi nahi mila — ab AI ki baari
    const drafts = await engine.ingestText('kal raat wale dinner ka paisa bhi add kar do');
    expect(ai.parseEntries).toHaveBeenCalledOnce();
    expect(drafts[0]?.warnings).toContain('ai_parsed');
  });

  it('AI fail ho jaye to bhi app nahi rukti', async () => {
    const ai = { parseEntries: vi.fn().mockRejectedValue(new Error('network down')) };
    const engine = new HisaabiEngine({ now: NOW, ai });

    await expect(engine.ingestText('kuch to kharcha hua tha')).resolves.toEqual([]);
    expect(ai.parseEntries).toHaveBeenCalled();
  });

  it('sawaal ka jawab ledger se aata hai', async () => {
    const engine = new HisaabiEngine({ now: NOW });
    const entries: Entry[] = [{
      id: '1', title: 'Zomato', merchant: 'Zomato', category: 'food',
      amountPaise: toPaise(318), type: 'expense', paidWith: 'digital',
      occurredAt: new Date(2026, 6, 5, 21).toISOString(), source: 'notification',
      confidence: 0.9, warnings: [], status: 'confirmed', createdAt: '', updatedAt: '',
    }];

    const res = await engine.ask('is mahine zomato pe kitna gaya', entries);
    expect(res?.plannedBy).toBe('rules');
    expect(res?.result.valuePaise).toBe(toPaise(318));
    expect(res?.answer).toContain('₹318');
  });

  it('samajh na aaye aur AI na ho to null', async () => {
    const engine = new HisaabiEngine({ now: NOW });
    expect(await engine.ask('mausam kaisa hai', [])).toBeNull();
  });
});
