# Hisaabi — Blueprint v3: Practical Finance Planner (the pivot)

Ye BLUEPRINT.md ka agla adhyaay hai. v2 me app ne **kharcha capture** karna sikha
(voice/notification/text → ledger). Ab v3 me app ek kadam aage jaata hai: sirf
hisaab rakhna nahi, balki **paise ka plan banana aur nibhwana** — ek personal
finance planner jo har bande ki apni situation ke hisaab se salah de.

Har badlav ke saath wajah likhi hai, taaki baad me koi "kyun aisa" na pooche.

---

## 0. Kyun pivot

"Bas bol do, app likh lega" — capture accha tha par **kaafi nahi**. User ko record
dikhne se paisa nahi bachta; usse **plan** chahiye:

- "Meri ₹25,000 salary hai — kaise baatun?"
- "Emergency fund kitna rakhun?"
- "Is mahine fun me zyada kharch ho gaya — ab kya karun?"
- "Mujhpe loan hai, do log dependent hain — mera plan doosre se alag hoga."

Isliye engine me ek naya, **deterministic** planner joda gaya: `buildMoneyPlan()`.
AI iska hissa **nahi** hai — plan poora rule-based hai, taaki har baar wahi, samajhne
laayak, aur galat na ho.

---

## 1. Planner: priority-waterfall (50/30/20 nahi)

Kitaabon wala 50/30/20 (needs/wants/savings) India ki low-income reality me tootta
hai — yahan needs hi aksar 60–70% ho jaati hain, to "30% wants" ka matlab hi nahi
banta. Isliye Hisaabi **priority waterfall** use karta hai: income upar se neeche,
har zaroori cheez pehle bhari jaati hai, jo bacha wahi aage jaata hai.

**Kram (waterfall):**

1. **Needs** — rent, bills, grocery, travel, health, education (fixed zaroorat)
2. **High-interest loan** — credit card / personal loan ki EMI (sabse mehnga paisa pehle)
3. **Emergency fund** — jab tak target poora na ho, har mahine isme daalte hain
4. **Goal / Invest** — user ka apna lakshya (ya default long-term saving)
5. **Fun** — jo bacha uska ek hissa (max 30%), par ek **floor** (kam se kam 8%) taaki zindagi ka dam na ghute
6. **Buffer** — jo tab bhi bache

Sum hamesha income ke barabar (integer paise me) — koi paisa "gayab" nahi hota.

### Situation-aware rules (har banda alag)

Yahi is app ki jaan hai — "sabke liye same" nahi. `MoneyProfile` ke hisaab se plan
badalta hai:

| Situation | Plan me asar |
|---|---|
| **Income irregular** (dihaadi/freelance) | Emergency fund target **6 mahine** (stable pe 3) — kyunki kal kaam ho na ho |
| **Dependents ≥ 1** | EF target +2 mahine (5), fun thoda kam — parivaar ki suraksha pehle |
| **Health insurance nahi** | EF me +1 mahine (medical jhatke ke liye buffer) |
| **High-interest loan hai** | Invest/goal **block** — pehle mehnga loan bharo (12–40% byaaj vs 8–12% return) |
| **Income < needs** | Status **red**, saaf salah: kharch ghatao ya kamai badhao — jhoothi tasalli nahi |
| **Goal EF se pehle** | Flag: pehle emergency fund, phir goal — warna jhatka aate hi goal toot jaata hai |

Config (engine me, ek jagah):
- `MIN_EMERGENCY_PAISE = ₹25,000` (chhoti income ke liye realistic pehla target)
- `FUN_FLOOR_RATE = 0.08`, `FUN_SHARE = 0.30`
- `emergencyMonths()`: base 3 → irregular 6 → dependents +? → no-insurance +1

Output: `buckets[]` (allocated paise), `flags[]` (PlanFlag enum), `status`
(`healthy` | `tight` | `red`), emergency-fund progress, goal progress.

---

## 2. Plan ko nibhwana (sirf banana kaafi nahi)

Plan bana dena aasaan; **usko chalaana** mushkil. Isliye 3 cheezein:

1. **Fun pulse (Home pe)** — roz dikhta hai "aaj fun me itna safe hai: ₹X". Plan
   zinda rehta hai, dabba band nahi.
2. **Overspend nudge** — fun budget cross hote hi ek baar notification (mahine me
   ek hi, taaki chidchid na ho). Text on-device banta hai — AI ko kabhi nahi jaata.
3. **Guardrail toggle (Settings)** — user khud chunta hai kitni sakhti:
   - **Soft coach** — pyaar se yaad dilata hai
   - **Strict** — seedhi baat, "ruk ja, budget over"

   Kyun user chune: kisi ko motivation chahiye, kisi ko discipline. App ka kaam
   thopna nahi, saath dena hai.

---

## 3. Capture-architecture v5 (is round me joda gaya)

Planner ka bharosa tabhi hai jab neeche ka data saaf ho. 5 sudhaar:

| # | Kya | Kyun |
|---|---|---|
| 1 | **`transfer` type** (apne hi wallet/account me paisa) | "Wallet me ₹1000 daala" na kharcha hai na kamai — warna double-count |
| 2 | **`refund` type** (paisa wapas) | Refund kharche ko **ghatata** hai; income maan lena galat number deta hai |
| 3 | **`txState`** (successful/pending/failed/reversed) | Failed transaction ledger me daalna hi galat — `isCounted()` sirf successful gine |
| 4 | **`rawEventIds[]`** | Ek hi payment ke kai source (UPI app + bank SMS) — merge pe sab yahin, dobara-count nahi |
| 5 | **AI output validation** | AI ka JSON ab sakht check hota hai: paise poora integer, type/category whitelist se, ₹1cr se upar block |

Notification parser ab khud detect karta hai: **failed → skip**, **refund/cashback →
refund**, **wallet-load / credit-card-bill → transfer**. Sab on-device regex se,
AI ke bina.

`spentBetween()` ab: refund subtract, transfer/failed/pending skip, kabhi negative
nahi (0 pe rukta hai). App ka `monthlyBucketSpend()` bhi wahi niyam maanta hai, taaki
plan ka "spent vs allotted" sach dikhaye.

---

## 4. Deferred backlog (jaan-boojh kar abhi NAHI banaya)

v1 ki galti thi sab ek saath banana. In cheezon ki zaroorat hai, par pehle upar wali
neev pakki honi chahiye. Jab user bole tab:

**Capture / accuracy**
- Recurring bills auto-detect (rent/EMI har mahine ki jagah ek rule)
- Subscriptions page (Netflix/Spotify — silent leaks)
- Split transaction (ek bill do category me)
- Merchant aliases (BLINKIT / Blinkit Pvt Ltd → ek)
- Cash wallet reconcile (jeb ka sach vs ledger)
- Undo / edit-after-confirm
- Refund ↔ original expense linking (kaunsa refund kis kharche ka)
- Duplicate-merge UI (rawEventIds ko surface karna)

**Planner / advice**
- Unusual-spend alert ("is category me is mahine 2x kharch")
- Loan payoff planner (avalanche vs snowball)
- Goal timeline ("is rate pe goal 14 mahine me")
- Plan-shift on income change (salary badli → plan auto re-balance)
- Weekly/monthly review card ("is hafte ye 3 cheezein")
- SIP / invest suggestion (educational, no product-pushing)

**Platform**
- Telegram bot (wahi engine)
- Backup / export (CSV, JSON)
- Multi-currency (abhi sirf INR)

**Niyam:** har feature tabhi banega jab (a) neev use bear kar sake, aur (b) user ne
maanga ho. "Ho sakta hai kaam aaye" wajah nahi hai.

---

## 5. Kya nahi badla (v2 se abhi bhi sach)

- Engine = pure TS, zero-dep, integer paise, data-in→data-out
- Raw event hamesha save, ledger derive hota hai
- Notification kabhi AI ko nahi jaata (OTP/balance/PII on-device rehta hai)
- AI provider-agnostic; band ho to app rule-parser pe chalti rehti hai
- Sab kuch offline-first, koi forced sign-in nahi
