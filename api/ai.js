/**
 * AI proxy — Vercel serverless function.
 *
 * API key SERVER pe rehti hai, app me kabhi nahi. Agar key app ke bundle me daali
 * jaye to koi bhi DevTools kholke utha lega, aur bill tumhara aayega.
 *
 * Env vars (Vercel → Settings → Environment Variables):
 *   GROQ_API_KEY     (pehli pasand — sabse tez)
 *   GEMINI_API_KEY   (backup — Groq ka rate limit lage to ye chal jata hai)
 *
 * Dono daalna behtar hai: ek ka quota khatam ho ya wo down ho, to doosra
 * sambhal leta hai. Dono me se ek bhi na ho to endpoint 503 deta hai, aur app
 * chup-chaap apne rule parser pe chalti rehti hai. Kuch tootta nahi.
 */

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GEMINI_MODEL = 'gemini-2.0-flash';

const MAX_INPUT = 600;
const TIMEOUT_MS = 9000;

const PARSE_SYSTEM = `Tum ek Hinglish expense parser ho.

User aksar poore din ka haal ek saath sunata hai — kahani ki tarah, bina comma ke.
Tumhe usme se HAR kharcha alag nikalna hai. Baaki baatein (mausam, mood, kisse
kya kaha) chhod dena — sirf paise wali baat chahiye.

Rules:
- Output SIRF JSON array ho. Koi explanation nahi, koi markdown fence nahi.
- Har object:
  {"title": string, "amount": number (rupees me), "type": "expense"|"income"|"cash_in",
   "daysAgo"?: number, "hour"?: number}
- Hindi/Hinglish numbers samjho, spelling galat ho tab bhi:
  bees/biss = 20, chalis/chaalees = 40, pachas/pachhaas = 50, saath = 60,
  assi = 80, sau = 100, ek sau chalis = 140, dhai sau = 250, sava sau = 125,
  sadhe teen sau = 350, paune do sau = 175, dedh hazaar = 1500.
- Word order koi bhi ho: "chini biss ki", "biss ki chini", "chini 20" — teeno = Chini, 20.
- WAQT: aaj=daysAgo 0, kal=1, parso=2. subah=hour 9, dopahar=13, shaam=18, raat=21.
  "5 baje shaam" = hour 17. Waqt na bataya ho to ye field chhod do.
  Ek baar waqt bola jaye to aage ke kharchon pe bhi wahi lagta hai, jab tak naya na aaye.
- KYA CHEEZ HAI, ye dhyan se dekho:
  · "chai 20"           → kharcha (expense)
  · "500 ATM se nikale" → cash_in (kharcha NAHI — paisa jeb me aaya)
  · "salary mili 25000" → income
  · "dost se 500 lene hain" / "Rahul ko 200 dene hain" → UDHAAR hai, kharcha nahi.
    Iski entry mat banao — chhod do. (App me udhaar ka hisaab alag se aa raha hai.)
  · "dost ne khilaya", "usne pay kiya" → user ne paisa nahi diya, entry mat banao.
- AMOUNT KISKA HAI, ye pakka karo. Number cheez ke pehle bhi aa sakta hai aur baad me bhi:
  "20 tea"  = Tea, 20      (tea 20 ka hai)
  "tea 20"  = Tea, 20
  Ek line me kai number hon to har number ko uski SAHI cheez se jodo, aage-peeche
  ke shabd dekh kar. Galat jodne se accha hai ki us hisse ko chhod do.
- Amount na mile to us hisse ko chhod do. Number kabhi invent mat karo.
- title 1-3 shabd, jaisa user ne bola waisa hi (English me translate mat karo).
  "Atm Dost Lene Hi" jaisa lamba/bematlab title kabhi mat banao.

Misal 1 — chhoti line:
"chai bees auto saath sabzi ek sau chalis"
[{"title":"Chai","amount":20,"type":"expense"},{"title":"Auto","amount":60,"type":"expense"},{"title":"Sabzi","amount":140,"type":"expense"}]

Misal 2 — poore din ki kahani:
"aaj subah uthke chai pi bees ki, phir office jane ke liye auto liya saath rupaye,
dopahar me office canteen me khana khaya assi ka, shaam ko dost mila to usne chai
pilai, aur raat ko ghar aate hue sabzi li ek sau chalis ki"
[{"title":"Chai","amount":20,"type":"expense","daysAgo":0,"hour":9},
 {"title":"Auto","amount":60,"type":"expense","daysAgo":0,"hour":9},
 {"title":"Canteen khana","amount":80,"type":"expense","daysAgo":0,"hour":13},
 {"title":"Sabzi","amount":140,"type":"expense","daysAgo":0,"hour":21}]
(dost ne chai pilai — uska paisa user ne nahi diya, isliye entry nahi bani)

Misal 3 — ulti-seedhi line, sab kuch mila-jula:
"20 tea 500 ATM se dost se 12 lene hi"
[{"title":"Tea","amount":20,"type":"expense"},
 {"title":"ATM se nikale","amount":500,"type":"cash_in"}]
(chai 20 ki thi — 500 nahi. 500 ATM se nikale, wo cash_in hai.
 "dost se 12 lene hain" udhaar hai — uski entry nahi bani.)`;

const ASK_SYSTEM = `Tum ek query planner ho. User apne kharchon ke baare me sawaal poochta hai.
SIRF ek JSON QueryPlan return karo — koi number, koi jawab nahi. Total database nikalega.

{"metric":"sum"|"count"|"avg"|"max"|"list",
 "filter":{"text"?:string,"category"?:string,"type"?:"expense"|"income","paidWith"?:"cash"|"digital"},
 "range":{"label":"today"|"yesterday"|"this_week"|"last_week"|"this_month"|"last_month"|"this_year"|"all_time"},
 "compareToPrevious"?:boolean,
 "groupBy"?:"category"|"merchant"|"day"}

Categories: food, grocery, travel, bills, shopping, health, rent, education, fun, other, income.
Samajh na aaye to {"metric":"sum","filter":{"type":"expense"},"range":{"label":"this_month"}}.`;

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const chain = providerChain();
    return res.status(200).json({
      ok: true,
      provider: chain[0]?.name ?? null,
      providers: chain.map((p) => p.name),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const chain = providerChain();
  if (!chain.length) {
    return res.status(503).json({ error: 'no_ai_configured' });
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body;
  const task = body?.task === 'ask' ? 'ask' : 'parse';
  const text = String(body?.text ?? '').slice(0, MAX_INPUT).trim();
  if (!text) return res.status(400).json({ error: 'empty_text' });

  const system = task === 'ask' ? ASK_SYSTEM : PARSE_SYSTEM;
  const user = buildUser(task, text, body?.context);

  // Pehla provider fail ho (rate limit, downtime, kharab jawab) to agla try karo.
  // Dono keys hain to app kabhi bina AI ke nahi rehti.
  let lastError = null;

  for (const provider of chain) {
    try {
      const raw = await withTimeout(provider.call(system, user), TIMEOUT_MS);
      const parsed = extractJson(raw);
      if (!parsed) throw new Error('bad output');

      return res.status(200).json({ provider: provider.name, task, result: parsed });
    } catch (err) {
      // key ya upstream ka message kabhi client ko mat bhejo
      console.error('[ai]', provider.name, err?.message);
      lastError = err;
    }
  }

  return res.status(502).json({ error: 'upstream_failed', detail: lastError ? 'all_providers_failed' : undefined });
}

/* ---------- providers ---------- */

/**
 * Groq pehle — wo sabse tez hai. Gemini backup, taki Groq ka rate limit
 * lagne pe bhi app ka AI zinda rahe.
 */
function providerChain() {
  const chain = [];
  if (process.env.GROQ_API_KEY) chain.push({ name: 'groq', call: callGroq });
  if (process.env.GEMINI_API_KEY) chain.push({ name: 'gemini', call: callGemini });
  return chain;
}

async function callGroq(system, user) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      max_tokens: 700,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${system}\n\nJawab ek JSON object me do: {"items": <array>} parse ke liye, ya plan object ask ke liye.` },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!res.ok) throw new Error(`groq ${res.status}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}

async function callGemini(system, user) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 700, responseMimeType: 'application/json' },
    }),
  });

  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

/* ---------- helpers ---------- */

function buildUser(task, text, context) {
  const lines = [task === 'ask' ? `Sawaal: "${text}"` : `Text: "${text}"`];
  if (context?.today) lines.push(`Aaj ki date: ${context.today}`);
  if (Array.isArray(context?.knownMerchants) && context.knownMerchants.length) {
    lines.push(`User ke common merchants: ${context.knownMerchants.slice(0, 20).join(', ')}`);
  }
  if (context?.tone) lines.push(context.tone);
  return lines.join('\n');
}

/** Model kabhi-kabhi markdown fence ya extra text laga deta hai — usme se JSON khodo. */
function extractJson(raw) {
  const text = String(raw ?? '').trim().replace(/^```(?:json)?|```$/g, '').trim();
  const direct = safeJson(text);
  if (direct) return unwrap(direct);

  const start = text.search(/[[{]/);
  if (start === -1) return null;
  const end = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'));
  if (end <= start) return null;

  return unwrap(safeJson(text.slice(start, end + 1)));
}

/** {"items":[…]} bhi chalega aur seedha […] bhi. */
function unwrap(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.entries)) return value.entries;
  return value;
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}
