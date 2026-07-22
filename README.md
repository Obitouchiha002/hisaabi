# Hisaabi

🌐 **Live:** https://hisaabii.vercel.app · 📲 **APK:** [Releases](https://github.com/Obitouchiha002/hisaabi/releases/latest)

**Bas bol do — hisaab khud ban jayega.**

Voice-first daily expense tracker for India. Ek voice note bolo → AI saare kharche alag-alag
entries bana deta hai. UPI/bank notifications se online kharche khud capture ho jaate hain.

- 🎤 **Voice entry** — "chai bees, auto saath, sabzi ek sau chalis" → 3 entries
- 📲 **Auto-capture** — GPay / PhonePe / Paytm / bank SMS notifications (on-device parsing, no `READ_SMS`)
- 💬 **Telegram bot** — voice note ya text bhejo, entry ban jaayegi
- 🧠 **Poocho kuch bhi** — "pichhle mahine Swiggy pe kitna gaya?"
- 🌙 **Raat 9 baje summary** + safe-to-spend number
- 📴 Offline-first, no ads, signup optional

---

## AI dimaag (Groq / Gemini)

App bina AI ke bhi poori chalti hai — rule parser "chai bees, auto saath" jaisi
~70% lines khud handle kar leta hai. AI sirf tab bulaya jata hai jab confidence 0.6 se kam ho.

**Key kabhi app me mat daalna.** `api/ai.js` ek Vercel serverless proxy hai; key wahin rehti hai:

```bash
cp .env.example .env        # local dev
# ya Vercel → Settings → Environment Variables
GROQ_API_KEY=...            # pehli pasand (llama-3.3-70b, sabse tez)
GEMINI_API_KEY=...          # fallback (gemini-2.0-flash)
```

Dono khaali → `/api/ai` 503 deta hai → app chup-chaap rules pe chalti rehti hai.
Settings me "AI dimaag" wala row batata hai ki abhi kya chal raha hai.

AI ko kya diya jata hai: sirf user ka bola/likha text, wo bhi PII scrub karke.
**Notification ka text kabhi AI ko nahi jata** — usme OTP aur balance ho sakta hai.

## Android APK

```bash
cd app
npm run build:android      # web build + cap sync
npx cap open android       # Android Studio khulega → Run / Build APK
```

Android Studio zaroori hai (usme JDK bhi aata hai). APK yahan milegi:
`app/android/app/build/outputs/apk/debug/app-debug.apk`

**Auto-capture:** APK install karne ke baad Settings → *Notification access* → Hisaabi on karo.
App ke Settings me bhi "Auto-capture" row hai jo seedha wahin le jata hai.
`READ_SMS` permission kahin nahi maangi jati — bank SMS ka notification hi kaafi hai.

**AI ke liye Android me:** app ke andar server nahi hota, isliye poora URL chahiye —
`app/.env` banao:

```bash
VITE_API_BASE=https://hisaabii.vercel.app
```

## Repo structure

```
.
├── index.html            # landing page (yeh abhi banaya hai)
├── app/                  # web app — Phase 2 (abhi placeholder)
├── assets/
│   ├── css/site.css      # design system: tokens → primitives → sections
│   ├── js/site.js        # theme toggle, nav, reveals, hero phone demo
│   └── img/
└── vercel.json           # static hosting config
```

## Local preview

```bash
npx serve .        # ya: python3 -m http.server 4173
```

Phir browser me `http://localhost:3000` kholo.

## Deploy (Vercel + GitHub)

1. GitHub pe repo banao aur push karo
2. Vercel → **Add New Project** → repo import karo
3. Framework preset: **Other** · Build command: *khaali chhodo* · Output directory: `.`
4. Deploy. Har `git push` pe auto-deploy ho jayega.

Koi build step nahi hai — plain HTML/CSS/JS.

## Design system

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#0A0B0D` | `#FAF8F3` |
| `--ink` | `#F2EFE9` | `#14150F` |
| `--accent` | `#D6FF3D` | `#C8F225` |

Fonts: **Bricolage Grotesque** (display) · **Inter Tight** (body) · **Instrument Serif** (italic accents).

### Themes

Do cheezein user chun sakta hai, dono `localStorage` me save hoti hain:

| | Key | Values |
|---|---|---|
| Light/Dark | `hisaabi-theme` | `dark` (default, OS preference se) · `light` |
| Accent rang | `hisaabi-accent` | `nimbu` (default) · `kesari` · `pudina` · `genda` · `jamun` |

Accent sirf `--accent` aur `--accent-ink` set karta hai — `--accent-soft` aur `--glow`
`color-mix()` se apne aap derive ho jate hain, isliye naya rang add karna 1 line ka kaam hai:

```css
:root[data-accent="mera-rang"] { --accent: #XXXXXX; --accent-ink: #YYYYYY; }
:root[data-theme="light"][data-accent="mera-rang"] { --accent: #...; --accent-ink: #...; }
```

Testing ke liye URL params bhi chalte hain: `?theme=light&accent=kesari`

## TODO (landing)

- [ ] APK link: `index.html` me `#apkBtn` ka href GitHub Releases pe point karta hai — release banne ke baad verify karo
- [ ] OG image (`assets/img/og.png`, 1200×630) banao aur `og:image` meta add karo
- [x] Domain: live at https://hisaabii.vercel.app
- [ ] Privacy policy page (`/privacy`) — notification access ke liye zaroori

## Roadmap

Poora product plan → [`PLAN.md`](./PLAN.md)

---

Banaya **Vansh Kashyap** ne 🇮🇳
