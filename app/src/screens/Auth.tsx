import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui';
import {
  AuthError, isValidEmail, pickAuth,
  type AuthAdapter, type SendResult, type Session,
} from '@/lib/auth';
import type { Profile } from '@/lib/profile';

/**
 * Email + code. Password nahi — password bhoolna bhi friction hai.
 *
 * Code 6 akshar ka hai (ginti + capital), sirf ank ka nahi: server bina kisi
 * database ke code jaanchta hai, aur usme sirf 6 ank andaza lagane layak hote.
 * Akshar milane se 88 crore possibilities ho jaati hain.
 *
 * Server na ho ya net na ho to bhi ye screen chalti hai — tab code yahin dikh
 * jata hai. Login ki wajah se app kabhi rukni nahi chahiye.
 */

const CODE_LEN = 6;

export function Auth({ profile, onDone }: { profile: Profile; onDone(session: Session | null): void }) {
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<SendResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resentAt, setResentAt] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const adapter = useRef<AuthAdapter | null>(null);

  useEffect(() => {
    if (stage === 'code') setTimeout(() => codeRef.current?.focus(), 300);
  }, [stage]);

  async function auth(): Promise<AuthAdapter> {
    adapter.current ??= await pickAuth();
    return adapter.current;
  }

  async function send() {
    if (!isValidEmail(email)) { setError('Email theek se likho'); return; }
    setBusy(true); setError(null);
    try {
      const a = await auth();
      setSent(await a.sendCode(email));
      setStage('code');
      setResentAt(Date.now());
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Code nahi bhej paya. Dobara try karo.');
    } finally {
      setBusy(false);
    }
  }

  async function verify(value: string) {
    if (!sent) return;
    setBusy(true); setError(null);
    try {
      const a = await auth();
      onDone(await a.verify(email, value, sent));
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Code galat hai');
      setCode('');
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen" key={stage}>
      <div className="row" style={{ marginBottom: 18 }}>
        {stage === 'code' && (
          <button className="icon-btn" onClick={() => { setStage('email'); setCode(''); setError(null); }}
                  aria-label="Peeche">
            {Icon.back}
          </button>
        )}
      </div>

      {stage === 'email' ? (
        <>
          <div className="q-head">
            <div className="q-step">Aakhri kadam</div>
            <h1>Sab taiyar hai, {profile.name}.</h1>
            <p>
              Email daalo taki tumhara hisaab kabhi na khoye — phone badla ya app hataayi,
              data wapas mil jayega.
            </p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <input
              className="text-field"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="tumhara@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
            />
            {error && <p className="auth-err">{error}</p>}

            <div className="q-foot">
              <button className="btn btn-primary btn-block" type="submit" disabled={busy || !email.trim()}>
                {busy ? 'Bhej raha hoon…' : 'Code bhejo'}
              </button>
              <button className="btn btn-quiet btn-block" type="button" onClick={() => onDone(null)}>
                Abhi nahi — bina account ke chalao
              </button>
            </div>
          </form>
        </>
      ) : (
        <>
          <div className="q-head">
            <div className="q-step">Code daalo</div>
            <h1>{CODE_LEN} akshar ka code</h1>
            <p>{email} pe bheja hai. Spam folder bhi dekh lena.</p>
          </div>

          <div style={{ position: 'relative' }}>
            <input
              ref={codeRef}
              value={code}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="one-time-code"
              spellCheck={false}
              maxLength={CODE_LEN}
              onChange={(e) => {
                // email me capital me dikhta hai; chhote akshar bhi chal jayein
                const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN);
                setCode(v);
                setError(null);
                if (v.length === CODE_LEN) void verify(v);
              }}
              style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%' }}
              aria-label="Code"
            />
            <div className="otp-row" onClick={() => codeRef.current?.focus()}>
              {Array.from({ length: CODE_LEN }, (_, i) => (
                <div key={i} className="otp-box" data-filled={!!code[i]} data-active={code.length === i}>
                  {code[i] ?? ''}
                </div>
              ))}
            </div>
          </div>

          {error && <p className="auth-err">{error}</p>}
          {busy && !error && <p className="hint-line">Jaanch raha hoon…</p>}

          {sent?.devCode && (
            <div className="dev-note">
              Abhi email server nahi laga hai, isliye code yahin dikha raha hoon: <b>{sent.devCode}</b>
            </div>
          )}

          <div className="q-foot">
            <button className="btn btn-ghost btn-block" type="button"
                    disabled={busy || Date.now() - resentAt < 20_000}
                    onClick={() => void send()}>
              Code dobara bhejo
            </button>
            <button className="btn btn-quiet btn-block" type="button" onClick={() => onDone(null)}>
              Bina account ke chalao
            </button>
          </div>
        </>
      )}
    </div>
  );
}
