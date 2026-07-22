# Hisaabi — Product Plan

> **Positioning:** *"Bas bol do — hisaab khud ban jayega."*
> Personal daily expense tracker for India. Online kharche khud pakad leta hai,
> cash kharche bol ke add ho jate hain.

**Locked decisions**

| | |
|---|---|
| Scope | Sirf personal kharcha (udhaar/dukaan nahi) |
| Platforms | Android app + Website + Telegram bot |
| Auto-capture | MVP me hi (hero feature) |
| Distribution | **Play Store nahi** — GitHub Releases se APK, Vercel pe website |
| Goal | Real users + paid Pro tier |

---

## 1. Problem

Expense apps 2 hafte me chhoot jaati hain kyunki:

1. **Entry ka friction** — har chai ke liye 6 tap
2. **Cash miss ho jata hai** — India me chhote kharche aaj bhi cash
3. **Data jata hai, jawab nahi aata** — pie chart dikhta hai, action nahi

Hisaabi teeno ko hit karta hai: voice (1), auto-capture (2), safe-to-spend + NL query (3).

## 2. Chaar pillars

- 🎤 **Bolo aur ho gaya** — ek voice note me 5 kharche, batch entry
- 📲 **Khud pakad lega** — UPI/bank notifications → auto entry (Android)
- 🧠 **Poocho kuch bhi** — apne data pe natural language sawaal
- 🌙 **Raat ka nudge** — 9 baje summary + safe-to-spend (retention engine)

## 3. Auto-capture — technical

`NotificationListenerService` (native Java plugin).

🔑 Bank SMS ka notification bhi Google Messages se aata hai → **`READ_SMS` permission ki
zaroorat hi nahi** (jo Play Store pe restricted hai, aur sideload me bhi user ko darata hai).

**Day-1 parsers:** GPay · PhonePe · Paytm · Google Messages (bank SMS) · CRED
**Fallback:** generic ₹-amount regex (`debited|paid|sent|spent`)

**Rules**
- Auto-entry seedha save nahi → **Review inbox**, ek tap me confirm/edit
- Parsing 100% on-device; notification text kabhi server pe nahi
- **Dedupe:** voice entry + notification same amount ±5 min → merge suggest karo

## 4. MVP feature list

**Core**
- Voice entry (device STT → AI parse)
- Manual quick-add (2 tap)
- Auto-capture + review inbox
- Home: aaj / hafta / mahina + top categories
- Cash wallet ("ATM se 2000 nikale")
- Offline-first + sync

**Retention (MVP me hi)**
- Raat 9 baje summary notification + safe-to-spend
- Telegram bot
- Website dashboard

**Pro-only**
- Unlimited voice, "Poocho kuch bhi", budgets, receipt scan, export, multi-device, family share

## 5. Architecture

```
Android   : Capacitor + React  +  Java plugin (NotificationListener, on-device parser)
Website   : same React codebase → PWA (/app)
Landing   : static HTML/CSS/JS (yeh repo ka root) → Vercel
Backend   : Supabase (Auth, Postgres + RLS, Realtime sync)
AI        : Supabase Edge Function → Claude Haiku 4.5 (structured JSON output)
STT       : Android SpeechRecognizer (free, hi-IN) → text
Bot       : Telegram Bot API → wahi Edge Function
Updates   : in-app update check → GitHub Releases (no Play Store)
Payments  : Razorpay / UPI link (Play Billing nahi, kyunki store pe nahi hain)
```

**Tables:** `accounts` · `transactions` · `categories` · `budgets` · `parse_rules` · `pending_captures`

**AI cost control**
1. Pehle regex/rules — "chai 20" jaise ~70% cases free me nipat jaate hain
2. Fail ho to hi Haiku call
3. User ke top merchants context me bhejo → accuracy up
→ **~₹0.30 / user / month**

## 6. Pricing

| Free (hamesha) | Pro — ₹399/saal · ₹999 lifetime |
|---|---|
| Unlimited manual entries | Sab free wala + |
| **Unlimited auto-capture** | Unlimited voice |
| 30 voice entries/mahina | "Poocho kuch bhi" |
| Basic reports, 1 device | Budgets, receipt scan, export, multi-device, family |

Auto-capture free rakhna zaroori hai — wahi roz ki aadat banata hai.

## 7. Roadmap

| Phase | Kaam | Time |
|---|---|---|
| **0. Landing** ✅ | Website (yeh repo) → Vercel | done |
| **1. MVP app** | Schema + local DB + manual/voice entry + AI parse + home | ~2 hafte |
| **2. Auto-capture** | Native notification listener + 5 parsers + review inbox | ~1 hafta |
| **3. Sync + web** | Supabase auth/sync, web dashboard, raat ka summary | ~1 hafta |
| **4. Smart** | NL query, budgets, safe-to-spend, cash wallet, Telegram bot | ~2 hafte |
| **5. Monetize** | Razorpay, Pro gating, landing update | ~1 hafta |

## 8. Risks

1. **Sideload trust** — Play Store nahi hone se log darte hain → website pe privacy section,
   open-source code, aur SHA-256 checksum dikhana zaroori hai
2. **AI mis-parse** → hamesha confirm card, kabhi silent save nahi
3. **iOS pe auto-capture possible nahi** → Android hero platform
4. **Retention** → summary + safe-to-spend MVP me hi, baad me nahi

## 9. Launch

15-second reel: *ek voice note → 5 entries ban gayi*. Yehi poora marketing hai.
Channels: Instagram/YouTube Shorts, r/india, r/IndiaInvestments, Product Hunt.
