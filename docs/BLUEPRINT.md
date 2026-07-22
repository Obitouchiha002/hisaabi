# Hisaabi — Engine & App Blueprint (v2, practical)

Ye original blueprint ka **implementable version** hai. Product ki soch wahi hai; jo cheezein
banane ke waqt tootengi, wo yahan theek ki gayi hain. Har badlav ke saath wajah likhi hai.

---

## 0. Original blueprint me kya badla, aur kyun

| # | Original | Naya | Kyun |
|---|---|---|---|
| 1 | Kotlin + Jetpack Compose + Room | **TypeScript engine + React UI + Capacitor + ek chhota Java plugin** | Website, Android app aur Telegram bot — teeno ko ek hi engine chahiye. Kotlin lene ka matlab hai web ke liye sab dobara likhna. UI bhi website jaisa chahiye — wo sirf web-based UI me hi bina dobara-design ke milega. |
| 2 | Engine "modules" ka list | **Engine = ek pure TS package** jisme na network hai, na DB, na UI | Sab kuch data-in → data-out. Isliye 100% unit-testable, aur wahi engine phone, browser aur bot me chalta hai. |
| 3 | `amount: 240` (rupees, float) | **Paise me integer** (`24000`) | Float me paisa rakhna classic bug hai (`0.1+0.2`). Display pe hi rupee banate hain. |
| 4 | Parsed entry seedha ledger me | **Raw event hamesha save**, ledger usse *derive* hota hai | Parser aage jaake behtar hoga. Raw text bacha ho to purani entries **dobara parse** ho sakti hain. Bina iske history hamesha kharab hi rahegi. |
| 5 | Duplicate detection "score checks" | **Fixed weights + hard rule: amount match zaroori** | Bina numbers ke ye feature har build me alag behave karega. |
| 6 | "Never save directly" | Wahi — par **batch confirm** allowed | 12 notification ek-ek karke confirm karna torture hai. Confidence zyada ho to pre-selected, ek tap me sab. |
| 7 | Notification → AI | **Notification kabhi AI ko nahi jata** | Notification me OTP/balance/account number ho sakta hai. Notification 100% on-device regex se parse hoga. AI sirf **user ke bole/likhe** text pe. |
| 8 | Gemini/Groq | **Provider-agnostic `AiAdapter`** | Engine ko pata hi nahi hona chahiye ki peeche kaun hai. Provider badalna 1 file ka kaam ho. |
| 9 | Phase 1 = UI screens | **Phase 0 = engine + tests, bina UI ke** | Engine hi product hai. Usko pehle green karo, UI baad me. |

---

## 1. Architecture

```
                    ┌──────────────────────────────────────────┐
   voice ──┐        │            hisaabi/engine                │
   text  ──┤        │  (pure TypeScript, zero dependencies)    │
   notif ──┼──raw──▶│                                          │──▶ DraftEntry[]
   telegram┘        │  normalize → parse → merchant → category │
                    │  → duplicate → confidence                │
                    └──────────────────────────────────────────┘
                                      │
                            ┌─────────┴─────────┐
                            ▼                   ▼
                     Review Inbox         (user confirm)
                            │                   │
                            └────────▶ Ledger (local DB) ────▶ budget / cash / ask
```

**Engine ka contract (tod-na mana hai):**

1. Engine me `fetch`, `localStorage`, `document`, DB — kuch nahi. Sirf functions.
2. Har function ka input aur output plain JSON hota hai.
3. Engine kabhi ledger me kuch save nahi karta. Wo sirf **draft** banata hai; save app karta hai, user ki confirmation ke baad.
4. AI optional hai. Bina AI ke bhi engine ka har hissa kaam karta hai (bas thoda kam accurate).
5. Paisa hamesha **integer paise**.

**Kahan-kahan chalta hai:** `app/` (React web + Capacitor Android), `bot/` (Telegram, Node), aur test suite.

## 2. Data model

```ts
RawEvent   { id, source, rawText, receivedAt, meta }        // kabhi delete nahi hota
DraftEntry { title, amountPaise, type, category, merchant,  // engine ka output
             paidWith, occurredAt, confidence, warnings }
Entry      { ...DraftEntry, id, status, rawEventId,         // confirmed ledger
             createdAt, updatedAt }
LearnedRule{ key, category, count, learnedAt }              // category memory
```

`type`: `expense` · `income` · `cash_in` (ATM withdrawal — kharcha nahi, cash wallet me paisa)
`paidWith`: `cash` · `digital` · `unknown`
`status`: `confirmed` · `ignored` · `duplicate`

**Kyun `cash_in` alag type hai:** ATM se ₹2,000 nikalna kharcha nahi hai — paisa jeb me aaya hai.
Agar usse expense maan lein to mahine ka total do baar count hoga (ek withdrawal, ek asli kharcha).

## 3. Engine pipeline

### 3.1 Normalize
lowercase → extra space hatao → PII scrub (account number, long digits, ref no) → segment split
(`,` `aur` `phir` `+` newline pe).

### 3.2 Hinglish numbers
`bees`→20, `saath`→60, `ek sau chalis`→140, `dhai sau`→250, `sava sau`→125, `sadhe teen sau`→350,
`paune do sau`→175, `dedh hazaar`→1500. Digits (`20`, `₹1,240`, `500rs`) bhi.
Ek segment me kai number-run mile to **sabse bada** liya jata hai (`"ek chai bees"` → 20, 1 nahi).

### 3.3 Parse
Har segment → `{title, amount, type, paidWith}`. Filler words (`aaj`, `ka`, `pe`, `rupaye`, `diye`,
`kharch`) hat jaate hain. Income keywords (`mila`, `salary`, `credited`) aur withdrawal keywords
(`atm`, `nikale`) type badal dete hain.

### 3.4 Notification → entry (on-device only)
- **Ignore**: OTP, balance enquiry, due reminder, offer/cashback, payment *request*.
- **Direction**: `debited|paid|sent|spent` → expense · `credited|received|refund` → income.
- **Merchant**: `to X`, `at X`, VPA (`name@bank`) se.
- **Scrub**: `XXXX1234`, 9+ digit runs, ref numbers → `[hidden]`.
- Amount ke liye currency symbol **zaroori** hai (`₹` / `Rs` / `INR`) — warna har number amount ban jayega.

### 3.5 Category
Priority: **user ka seekha rule → merchant rule → keyword rule → AI (optional) → Anya**.
Auto-learning: same merchant pe user 2 baar same correction kare → rule ban jata hai (`count>=2`),
aur woh rule user ko dikhta hai (Settings → "Hisaabi ne kya seekha") taki hata bhi sake.

### 3.6 Duplicate
**Hard rule:** amount alag → duplicate nahi (score 0). Uske baad:

| Signal | Weight |
|---|---|
| Same amount (base) | 0.50 |
| ≤3 min gap | +0.30 · ≤10 min +0.20 · ≤30 min +0.05 |
| Same merchant | +0.20 (ek doosre me contain ho to +0.10) |
| Alag source (notification vs voice) | +0.05 |
| Same transaction ref | → 1.00 (pakka) |

`score ≥ 0.75` → review card pe "Ye same transaction lagta hai" warning + merge suggestion.

### 3.7 Confidence
`0.9+` digits wala saaf amount · `0.75` word-number · `-0.2` title na mila · `-0.15` merchant unknown.
UI: `≥0.85` pre-selected (batch confirm) · `0.5–0.85` confirm chahiye · `<0.5` peela highlight + edit hint.

### 3.8 Safe-to-spend
```
left    = monthlyBudget − confirmedExpensesThisMonth − reservedBills
perDay  = left / daysLeftInMonth        (aaj included, minimum 1)
status  = perDay <= 0 ? 'over' : perDay < 0.6 × avgSoFar ? 'tight' : 'good'
```

### 3.9 Ask Hisaabi
`question → QueryPlan (JSON) → deterministic executor → answer text`

```ts
QueryPlan {
  metric: 'sum'|'count'|'avg'|'max'|'list',
  filter: { merchant?, category?, type?, paidWith? },
  range:  { from, to, label },
  compareToPrevious?: boolean,
  groupBy?: 'category'|'merchant'|'day'
}
```
Rules pehle try karte hain; na samajh aaye tabhi AI se **sirf plan** banwate hain.
**AI kabhi total nahi batata** — number hamesha database se aata hai.

## 4. AI boundary

| AI karega | AI kabhi nahi karega |
|---|---|
| Ulti-seedhi Hinglish line samajhna (jab rules fail hon) | Koi bhi jod-ghata / total |
| Category suggest karna (jab rule na ho) | Ledger me save |
| Sawaal ko QueryPlan me badalna | Duplicate ka faisla |
| — | Notification text chhoona |

```ts
interface AiAdapter {
  parseEntries?(text: string, ctx: AiContext): Promise<DraftEntry[]>
  suggestCategory?(merchant: string, title: string): Promise<CategoryId | null>
  planQuery?(question: string, ctx: AiContext): Promise<QueryPlan | null>
}
```
App adapter inject karta hai (server proxy ke through, taki API key phone me na ho).
Adapter na ho → engine rules pe chalta rahega. **Offline me app poori kaam karti hai.**

## 5. Cost control

1. Rule parser pehle — "chai 20", "auto 60" jaise ~70% cases yahin nipat jate hain, ₹0 me.
2. AI tabhi jab confidence `< 0.6`.
3. AI call me user ke top 20 merchants context me jaate hain → accuracy up, retry down.
4. Har AI call ka result raw event pe cache hota hai (same text dobara → dobara call nahi).

Target: **₹0.30 / user / month**.

## 6. Build order

| Phase | Kya | Kyun pehle |
|---|---|---|
| **0. Engine** ← abhi | Parser, category, duplicate, budget, ask + tests | Engine hi product hai. Bina UI ke pura test ho jata hai. |
| 1. Shell + DB | React app, local DB, home screen, manual entry | Engine ko pehli baar asli data milta hai |
| 2. Voice | Device STT → engine → editable chips → confirm | Sabse bada wow, par engine ke bina bekaar |
| 3. Capture | Java NotificationListener plugin → Review Inbox | Native kaam, isliye baad me |
| 4. Ask + budget UI | Safe-to-spend, sawaal-jawaab | Engine ready hai, sirf screen chahiye |
| 5. Sync, export, Pro | Supabase, CSV/PDF, payments | Tab jab log use karne lagein |

## 7. Testing

Engine ka har module unit-tested. Sabse zaroori: **golden corpus** —
`__tests__/fixtures/` me asli Hinglish lines aur asli notification texts, expected output ke saath.
Naya bug mile → pehle uski line fixture me daalo, phir fix karo. Isse parser kabhi peeche nahi jata.

## 8. Jo abhi nahi banega

Bank linking · Account Aggregator · loans · credit score · investment advice · insurance ·
crypto · 10 tarah ke charts · WhatsApp Business bot · lamba onboarding.

Wajah: trust friction, compliance risk, aur development time — teeno badhte hain, aur inme se koi
bhi "aaj kitna kharch safe hai" ka jawab behtar nahi banata.
