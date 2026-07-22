/**
 * Auth — pluggable.
 *
 * Abhi `localAuth` chalta hai: koi server nahi, OTP screen pe hi dikh jata hai.
 * Isse poori app bina backend ke chalti hai (aur "signup optional" wala vaada bhi bacha rehta hai).
 *
 * Supabase/aur koi backend aane pe sirf ye file badalni hai — baaki app ko farq nahi padta.
 */

export interface Session {
  email: string;
  /** local = bina server ke, sirf is phone pe */
  provider: 'local' | 'supabase';
  createdAt: string;
}

export interface AuthAdapter {
  /** email pe code bhejo. Local mode me code wapas aa jata hai (screen pe dikhane ke liye). */
  sendCode(email: string): Promise<{ devCode?: string }>;
  verify(email: string, code: string): Promise<Session>;
}

const SESSION_KEY = 'hisaabi-session';

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

const CODE_KEY = 'hisaabi-devcode';

export const localAuth: AuthAdapter = {
  async sendCode(email) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    sessionStorage.setItem(CODE_KEY, `${email.toLowerCase()}:${code}`);
    await delay(600); // asli network jaisa feel
    return { devCode: code };
  },

  async verify(email, code) {
    await delay(500);
    const expected = sessionStorage.getItem(CODE_KEY);
    if (expected !== `${email.toLowerCase()}:${code}`) {
      throw new Error('Code galat hai');
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

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
