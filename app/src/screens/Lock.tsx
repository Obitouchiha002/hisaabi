import { useEffect, useState } from 'react';
import { hasLock, setLock, unlock } from '@/lib/lock';
import { useT } from '@/lib/i18n';

/**
 * PIN screen — set karne aur kholne, dono ke liye yahi.
 *
 * Apna keypad hai, phone ka keyboard nahi. Keyboard aadhi screen kha jata hai,
 * aur PIN daalna itna aam kaam hai ki har baar keyboard khulna khatakega.
 */

const PIN_LEN = 4;

export function Lock({
  mode,
  onDone,
  onSkip,
}: {
  mode: 'set' | 'open';
  onDone(): void;
  /** sirf set karte waqt — "abhi nahi" */
  onSkip?(): void;
}) {
  const t = useT();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waitLeft, setWaitLeft] = useState(0);

  const asking = mode === 'set' && confirm !== null;

  useEffect(() => {
    if (waitLeft <= 0) return;
    const timer = setInterval(() => setWaitLeft((w) => Math.max(0, w - 1000)), 1000);
    return () => clearInterval(timer);
  }, [waitLeft]);

  useEffect(() => {
    if (pin.length !== PIN_LEN) return;

    void (async () => {
      if (mode === 'set') {
        if (confirm === null) { setConfirm(pin); setPin(''); return; }
        if (confirm !== pin) {
          setError(t("The two didn't match — try again", 'Dono baar alag tha — phir se'));
          setConfirm(null); setPin('');
          return;
        }
        await setLock(pin);
        onDone();
        return;
      }

      const res = await unlock(pin);
      if (res.ok) { onDone(); return; }

      setPin('');
      if (res.waitMs) { setWaitLeft(res.waitMs); setError(null); }
      else setError(t(`Wrong PIN — ${res.left} tries left`, `Galat PIN — ${res.left} koshish bachi`));
    })();
  }, [pin, mode, confirm, onDone, t]);

  const blocked = waitLeft > 0;

  const title = mode === 'open'
    ? t('Enter PIN', 'PIN daalo')
    : asking ? t('Once more', 'Ek baar aur') : t('Set a PIN', 'PIN bana lo');

  const note = mode === 'open'
    ? t('Before Hisaabi opens.', 'Hisaabi khulne se pehle.')
    : asking
      ? t('Enter the same PIN again to confirm.', 'Pakka karne ke liye wahi PIN dobara.')
      : t(
          "So no one who picks up your phone can see your money. It never leaves this phone.",
          'Kisi aur ne phone uthaya to hisaab na dikhe. Ye sirf is phone me rehta hai.',
        );

  return (
    <div className="screen lock-screen">
      <div className="q-head">
        <div className="q-step">{mode === 'open' ? t('Lock', 'Lock') : t('Security', 'Suraksha')}</div>
        <h1>{title}</h1>
        <p>{note}</p>
      </div>

      <div className="pin-row">
        {Array.from({ length: PIN_LEN }, (_, i) => (
          <span key={i} className="pin-dot" data-on={i < pin.length} />
        ))}
      </div>

      {error && <p className="auth-err" style={{ textAlign: 'center' }}>{error}</p>}
      {blocked && (
        <p className="auth-err" style={{ textAlign: 'center' }}>
          {t(
            `Too many wrong tries — wait ${Math.ceil(waitLeft / 1000)}s`,
            `Bahut galat koshish — ${Math.ceil(waitLeft / 1000)} second ruko`,
          )}
        </p>
      )}

      <div className="pin-pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
          <button key={k} className="pin-key" disabled={blocked}
                  onClick={() => { setError(null); setPin((p) => (p + k).slice(0, PIN_LEN)); }}>
            {k}
          </button>
        ))}
        <span />
        <button className="pin-key" disabled={blocked}
                onClick={() => { setError(null); setPin((p) => (p + '0').slice(0, PIN_LEN)); }}>
          0
        </button>
        <button className="pin-key" data-quiet="" disabled={blocked || !pin}
                onClick={() => setPin((p) => p.slice(0, -1))} aria-label={t('Delete', 'Mitao')}>
          ⌫
        </button>
      </div>

      {onSkip && (
        <div className="q-foot">
          <button className="btn btn-quiet btn-block" onClick={onSkip}>
            {hasLock() ? t('Leave it', 'Rehne do') : t('Not now — use without a PIN', 'Abhi nahi — bina PIN ke chalao')}
          </button>
        </div>
      )}
    </div>
  );
}
