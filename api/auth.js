/**
 * Email verification — Vercel serverless function.
 *
 * Do kaam: code bhejna, aur code jaanchna.
 *
 * Yahan koi database nahi hai, aur ye jaan-boojh kar hai. Aam tareeka ye hota
 * hai ki OTP kisi table me likh do aur verify pe padh lo — uske liye Redis ya
 * Postgres chahiye, uska kharcha hai, aur ek aur cheez hai jo kharab ho sakti
 * hai. Yahan iske badle **signed challenge** chalta hai:
 *
 *   1. Server code banata hai, aur ek "challenge" bhi —
 *      challenge = expiry + "." + HMAC(secret, email|code|expiry)
 *   2. Code email pe jata hai, challenge app ko wapas milta hai.
 *      Challenge se code nahi nikala ja sakta (HMAC ek tarfa hai).
 *   3. App code + challenge dono bhejti hai; server HMAC dobara bana kar
 *      milata hai. Bas — koi storage nahi.
 *
 * Code 6 akshar ka hai (ginti + capital, milte-julte akshar hataye hue) =
 * 31^6 ≈ 88 crore possibilities. Andaaza lagana namumkin hai, aur likhna
 * aasan — "K7M2QP".
 *
 * Env vars (Vercel → Settings → Environment Variables):
 *   AUTH_SECRET      (zaroori — koi bhi lamba random string)
 *   BREVO_API_KEY    (email bhejne ke liye — 300 email/din muft, domain nahi chahiye)
 *   RESEND_API_KEY   (ya phir ye — par iske liye apna domain verify karna padta hai)
 *   MAIL_FROM        ("Hisaabi <tumhara@gmail.com>" — Brevo me verified sender hona chahiye)
 *   AUTH_DEV_CODE=1  (sirf testing me — code jawab me hi wapas aa jata hai)
 */

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import { cors } from './_cors.js';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // O/0, I/1/L hataye — likhne me galti na ho
const CODE_LENGTH = 6;
const TTL_MS = 10 * 60 * 1000;          // code 10 minute chalta hai
const SESSION_DAYS = 180;

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      configured: Boolean(process.env.AUTH_SECRET),
      mailer: mailerName(),
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!process.env.AUTH_SECRET) {
    // App is haalat me bina account ke chalti rehti hai — kuch tootta nahi.
    return res.status(503).json({ error: 'auth_not_configured' });
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body;
  const action = body?.action;
  const email = normaliseEmail(body?.email);

  if (!email) return res.status(400).json({ error: 'bad_email' });

  if (action === 'send') return send(res, email);
  if (action === 'verify') return verify(res, email, String(body?.code ?? ''), String(body?.challenge ?? ''));

  return res.status(400).json({ error: 'bad_action' });
}

/* ---------- code bhejo ---------- */

async function send(res, email) {
  const code = makeCode();
  const expiresAt = Date.now() + TTL_MS;
  const challenge = `${expiresAt}.${sign(`${email}|${code}|${expiresAt}`)}`;

  const mailer = pickMailer();

  if (!mailer) {
    // Email service abhi nahi lagi. Testing me code wapas de do; asli me mana kar do,
    // warna koi bhi kisi ka bhi email daal kar andar aa jayega.
    if (process.env.AUTH_DEV_CODE === '1') {
      return res.status(200).json({ challenge, expiresAt, devCode: code });
    }
    return res.status(503).json({ error: 'mailer_not_configured' });
  }

  try {
    await mailer.send(email, code);
  } catch (err) {
    console.error('[auth] mail', mailer.name, err?.message);
    return res.status(502).json({ error: 'mail_failed' });
  }

  return res.status(200).json({ challenge, expiresAt });
}

/* ---------- code jaancho ---------- */

function verify(res, email, code, challenge) {
  const dot = challenge.lastIndexOf('.');
  if (dot < 1) return res.status(400).json({ error: 'bad_challenge' });

  const expiresAt = Number(challenge.slice(0, dot));
  const mac = challenge.slice(dot + 1);

  if (!Number.isFinite(expiresAt)) return res.status(400).json({ error: 'bad_challenge' });
  if (Date.now() > expiresAt) return res.status(410).json({ error: 'code_expired' });

  const clean = code.trim().toUpperCase();
  if (!sameString(mac, sign(`${email}|${clean}|${expiresAt}`))) {
    return res.status(401).json({ error: 'wrong_code' });
  }

  return res.status(200).json({ email, token: makeToken(email) });
}

/* ---------- session token ---------- */

/** payload.hmac — server hi bana aur padh sakta hai, kyunki secret sirf yahan hai. */
function makeToken(email) {
  const payload = b64url(JSON.stringify({
    email,
    iat: Date.now(),
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  }));
  return `${payload}.${sign(payload)}`;
}

/** Baad me sync API isse session jaanchegi. */
export function readToken(token) {
  const dot = String(token ?? '').lastIndexOf('.');
  if (dot < 1) return null;

  const payload = token.slice(0, dot);
  if (!sameString(token.slice(dot + 1), sign(payload))) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Date.now() > data.exp ? null : data;
  } catch {
    return null;
  }
}

/* ---------- email bhejne wale ---------- */

function mailerName() {
  return pickMailer()?.name ?? null;
}

/**
 * Brevo pehle: usme sirf ek sender email verify karna padta hai (gmail bhi chalega),
 * apna domain nahi chahiye. Resend behtar hai par usme domain zaroori hai.
 */
function pickMailer() {
  if (process.env.BREVO_API_KEY) return { name: 'brevo', send: sendViaBrevo };
  if (process.env.RESEND_API_KEY) return { name: 'resend', send: sendViaResend };
  return null;
}

function fromAddress() {
  const raw = process.env.MAIL_FROM ?? 'Hisaabi <onboarding@resend.dev>';
  const m = raw.match(/^\s*(.*?)\s*<(.+)>\s*$/);
  return m ? { name: m[1] || 'Hisaabi', email: m[2] } : { name: 'Hisaabi', email: raw.trim() };
}

async function sendViaBrevo(to, code) {
  const from = fromAddress();
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: from.name, email: from.email },
      to: [{ email: to }],
      subject: `${code} — Hisaabi ka code`,
      textContent: textBody(code),
      htmlContent: htmlBody(code),
    }),
  });
  if (!r.ok) throw new Error(`brevo ${r.status} ${(await r.text()).slice(0, 120)}`);
}

async function sendViaResend(to, code) {
  const from = fromAddress();
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `${from.name} <${from.email}>`,
      to: [to],
      subject: `${code} — Hisaabi ka code`,
      text: textBody(code),
      html: htmlBody(code),
    }),
  });
  if (!r.ok) throw new Error(`resend ${r.status} ${(await r.text()).slice(0, 120)}`);
}

function textBody(code) {
  return `Tumhara Hisaabi code: ${code}

10 minute me daal dena.

Ye code tumne nahi manga? To ignore kar do — bina code ke koi andar nahi aa sakta.`;
}

/** Sirf inline CSS — email clients <style> aur external CSS kaat dete hain. */
function htmlBody(code) {
  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#faf8f3;padding:32px 16px">
  <div style="max-width:440px;margin:0 auto;background:#fff;border:1px solid #e6e2d8;border-radius:20px;padding:32px">
    <div style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;background:#c8f225;color:#14170a;border-radius:10px;font-weight:800;font-size:19px">&#8377;</div>
    <h1 style="font-size:20px;margin:18px 0 6px;color:#14150f">Tumhara code</h1>
    <p style="margin:0 0 20px;color:#55564c;font-size:15px;line-height:1.5">Hisaabi me email verify karne ke liye ye daal do.</p>
    <div style="font-size:34px;font-weight:800;letter-spacing:.16em;color:#14150f;background:#f6f3ec;border-radius:14px;padding:18px;text-align:center">${code}</div>
    <p style="margin:20px 0 0;color:#83847a;font-size:13px;line-height:1.6">
      10 minute me daal dena.<br>
      Ye code tumne nahi manga? To ignore kar do — bina code ke koi andar nahi aa sakta.
    </p>
  </div>
</div>`;
}

/* ---------- chhoti madad ---------- */

function makeCode() {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

function sign(value) {
  return createHmac('sha256', process.env.AUTH_SECRET).update(value).digest('base64url');
}

/** Lambai se bhi kuch pata na chale, isliye pehle length check phir constant-time compare. */
function sameString(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function normaliseEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) && email.length <= 254 ? email : null;
}

function b64url(text) {
  return Buffer.from(text, 'utf8').toString('base64url');
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}
