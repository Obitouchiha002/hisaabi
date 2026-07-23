/**
 * Auth — pluggable.
 *
 * Do adapter hain:
 *   remoteAuth — asli email verification (`/api/auth`)
 *   localAuth  — bina server ke; code screen pe hi dikh jata hai
 *
 * Jo chalega wo `pickAuth()` khud tay karta hai: server se poochta hai ki
 * email bhejne ka intezaam hai ya nahi. Nahi hai to local chalta hai — app
 * phir bhi poori chalti hai, aur "signup optional" wala vaada bacha rehta hai.
 */

export interface Session {
  email: string;
  /** local = bina server ke, sirf is phone pe */
  provider: 'local' | 'email' | 'supabase';
  createdAt: string;
  /** server wala session token — baad me sync isse chalega */
  token?: string;
}

export interface SendResult {
  /** local mode me code yahin wapas aata hai (screen pe dikhane ke liye) */
  devCode?: string;
  /** server wala signed challenge — verify me wapas bhejna hota hai */
  challenge?: string;
}

export interface AuthAdapter {
  name: 'local' | 'email';
  sendCode(email: string): Promise<SendResult>;
  verify(email: string, code: string, sent: SendResult): Promise<Session>;
}

const SESSION_KEY = 'hisaabi-session';

// Web pe same-origin. Android me server hota hi nahi, isliye wahan poora URL —
// app/.env me VITE_API_BASE=https://hisaabii.vercel.app
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
const ENDPOINT = `${API_BASE}/api/auth`;

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim());
}

/* ---------- asli email verification ---------- */

/** Server ne jo bola wahi user ko dikhao — "kuch galat ho gaya" se koi madad nahi milti. */
const MESSAGES: Record<string, string> = {
  wrong_code: 'Code galat hai',
  code_expired: 'Code purana ho gaya — naya mangwao',
  bad_challenge: 'Kuch gadbad hui — naya code mangwao',
  mail_failed: 'Email nahi ja paya. Thodi der baad try karo.',
  mailer_not_configured: 'Email bhejne ka intezaam abhi nahi hai',
  auth_not_configured: 'Login abhi band hai',
};

export class AuthError extends Error {
  constructor(public code: string) {
    super(MESSAGES[code] ?? 'Kuch theek nahi hua. Dobara try karo.');
  }
}

async function post(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new AuthError(String(json.error ?? 'unknown'));
  return json;
}

export const remoteAuth: AuthAdapter = {
  name: 'email',

  async sendCode(email) {
    const json = await post({ action: 'send', email: email.trim().toLowerCase() });
    return {
      challenge: json.challenge as string,
      // sirf tab aata hai jab server pe AUTH_DEV_CODE=1 ho
      devCode: (json.devCode as string | undefined) ?? undefined,
    };
  },

  async verify(email, code, sent) {
    const json = await post({
      action: 'verify',
      email: email.trim().toLowerCase(),
      code,
      challenge: sent.challenge,
    });

    const session: Session = {
      email: json.email as string,
      provider: 'email',
      createdAt: new Date().toISOString(),
      token: json.token as string,
    };
    saveSession(session);
    return session;
  },
};

/* ---------- bina server ke ---------- */

const CODE_KEY = 'hisaabi-devcode';

export const localAuth: AuthAdapter = {
  name: 'local',

  async sendCode(email) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    sessionStorage.setItem(CODE_KEY, `${email.toLowerCase()}:${code}`);
    await delay(600); // asli network jaisa feel
    return { devCode: code };
  },

  async verify(email, code) {
    await delay(500);
    if (sessionStorage.getItem(CODE_KEY) !== `${email.toLowerCase()}:${code}`) {
      throw new AuthError('wrong_code');
    }
    sessionStorage.removeItem(CODE_KEY);

    const session: Session = {
      email: email.toLowerCase(),
      provider: 'local',
      createdAt: new Date().toISOString(),
    };
    saveSession(session);
    return session;
  },
};

/**
 * Kaunsa adapter chalega.
 *
 * Server se ek baar pooch lete hain. Net na ho ya server thanda ho to local —
 * login ki wajah se app rukni nahi chahiye.
 */
let cached: AuthAdapter | null = null;

export async function pickAuth(): Promise<AuthAdapter> {
  if (cached) return cached;
  try {
    const res = await fetch(ENDPOINT, { method: 'GET' });
    const json = (await res.json()) as { configured?: boolean; mailer?: string | null };
    cached = json.configured && json.mailer ? remoteAuth : localAuth;
  } catch {
    cached = localAuth;
  }
  return cached;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
