# @hisaabi/engine

Hisaabi ka dimaag. **Pure TypeScript, zero dependencies.**

Messy real-life input (bola hua, likha hua, UPI notification) → saaf transaction draft.

```bash
npm install
npm test          # 105 tests
npm run typecheck
```

## Niyam (ye kabhi nahi tootne chahiye)

1. Engine me `fetch`, `localStorage`, `document`, DB — **kuch nahi**. Sirf functions.
2. Har function ka input aur output plain JSON.
3. Engine **kabhi kuch save nahi karta**. Sirf draft banata hai; save app karti hai, user ke confirm ke baad.
4. AI **optional** hai. Bina AI ke bhi sab kuch chalta hai — bas thoda kam accurate.
5. Paisa hamesha **integer paise** (`₹20` = `2000`). Float me paisa = bug.
6. Notification ka text **kabhi AI ko nahi jata** (usme OTP/balance ho sakta hai).

Isi wajah se yahi engine web app, Android app aur Telegram bot — teeno me chalta hai.

## Istemaal

```ts
import { HisaabiEngine } from '@hisaabi/engine';

const engine = new HisaabiEngine({ rules: savedRules, ai: myAiAdapter });

// 1. Bola hua / likha hua
const drafts = await engine.ingestText('chai bees, auto saath, sabzi ek sau chalis', { source: 'voice' });
// → [{ title:'Chai', amountPaise:2000, category:'food' }, { 'Auto', 6000, 'travel' }, { 'Sabzi', 14000, 'grocery' }]

// 2. UPI notification (100% on-device)
const draft = engine.ingestNotification(rawEvent);
// → { merchant:'Blinkit', amountPaise:24000, category:'grocery', sourceApp:'PhonePe' }

// 3. Review Inbox — duplicate check + batch confirm flag
const items = engine.review(drafts, recentEntries);
// → [{ draft, duplicates:[...], preSelected:true }]

// 4. Sawaal — number hamesha ledger se
const res = await engine.ask('is mahine zomato pe kitna gaya', entries);
// → "Is mahine Zomato pe ₹558 gaya — 2 kharche. Pichhle mahine se ₹258 zyada."
```

## Modules

| File | Kaam |
|---|---|
| `types.ts` | Core types — `RawEvent`, `DraftEntry`, `Entry`, `LearnedRule` |
| `money.ts` | Paise ↔ rupee, Indian grouping (`₹12,34,567`) |
| `numbers.ts` | Hinglish numbers → digits (`dhai sau` → 250) |
| `normalize.ts` | Safai, **PII scrubbing**, segment split |
| `parse.ts` | Text → `DraftEntry[]` (multi-entry, income, ATM withdrawal) |
| `notifications.ts` | UPI/bank notification → draft (regex only, on-device) |
| `categories.ts` | Category rules + **auto-learning** |
| `duplicates.ts` | Cross-source duplicate detection |
| `budget.ts` | Safe-to-spend + cash wallet |
| `ask.ts` / `query.ts` | Sawaal → QueryPlan → deterministic jawab |
| `ai.ts` | `AiAdapter` interface + prompts (yahan network nahi hai) |

## Hinglish numbers

```
bees 20 · saath 60 · pachas 50 · ek sau chalis 140 · do sau 200
dhai sau 250 · sava sau 125 · sadhe teen sau 350 · paune do sau 175 · dedh hazaar 1500
```

Ambiguity handle hoti hai: `"add kar do"` me `do` = *karo*, ₹2 nahi.
`"ke saath gaya"` me `saath` = *with*, ₹60 nahi — par `"auto saath"` me ₹60 hi hai.

## Golden corpus

Naya parser bug mile → **pehle uski line test me daalo**, phir fix karo
(`tests/numbers.test.ts` me "golden corpus" wala block dekho). Isse parser kabhi peeche nahi jata.

## Aage kya

Engine ready hai. Ab iske upar app banegi — dekho [`../docs/BLUEPRINT.md`](../docs/BLUEPRINT.md) ka build order.
