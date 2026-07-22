import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui';
import { isValidEmail, localAuth, type Session } from '@/lib/auth';
import type { Profile } from '@/lib/profile';

/**
 * Email + 6-digit code. Password nahi — kyunki password bhoolna bhi friction hai.
 *
 * Abhi local mode hai (code screen pe hi dikhta hai). Backend lagte hi
 * sirf lib/auth.ts badalna hai, ye screen waisi hi rahegi.
 */

export function Auth({ profile, onDone }: { profile: Profile; onDone(session: Session | null): void }) {
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stage === 'code') setTimeout(() => codeRef.current?.focus(), 300);
  }, [stage]);

  async function send() {
    if (!isValidEmail(email)) { setError('Email theek se likho'); return; }
    setBusy(true); setError(null);
    try {
      const res = await localAuth.sendCode(email);
      setDevCode(res.devCode ?? null);
      setStage('code');
    } catch {
      setError('Code nahi bhej paya. Dobara try karo.');
    } finally {
      setBusy(false);
    }
  }

  async function verify(value: string) {
    setBusy(true); setError(null);
    try {
      onDone(await localAuth.verify(email, value));
    } catch {
      setError('Code galat hai');
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen" key={stage}>
      <div className="row" style={{ marginBottom: 18 }}>
        {stage === 'code' && (
          <button className="icon-btn" onClick={() => { setStage('email'); setCode(''); }} aria-label="Peeche">
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
            {error && <p style={{ color: 'var(--bad)', fontSize: 14, marginTop: 10 }}>{error}</p>}

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
            <h1>6 ank ka code</h1>
            <p>{email} pe bheja hai.</p>
          </div>

          <div style={{ position: 'relative' }}>
            <input
              ref={codeRef}
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(v);
                setError(null);
                if (v.length === 6) void verify(v);
              }}
              style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%' }}
              aria-label="Code"
            />
            <div className="otp-row" onClick={() => codeRef.current?.focus()}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="otp-box" data-filled={!!code[i]} data-active={code.length === i}>
                  {code[i] ?? ''}
                </div>
              ))}
            </div>
          </div>

          {error && <p style={{ color: 'var(--bad)', fontSize: 14, marginTop: 12 }}>{error}</p>}

          {devCode && (
            <div className="dev-note">
              Abhi email server nahi laga hai, isliye code yahin dikha raha hoon: <b>{devCode}</b>
            </div>
          )}

          <div className="q-foot">
            <button className="btn btn-ghost btn-block" type="button" disabled={busy} onClick={() => void send()}>
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
