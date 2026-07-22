import { useState } from 'react';
import { formatINR, toPaise } from '@engine';
import { Sheet } from '@/components/ui';
import { useStore } from '@/lib/store';
import { db } from '@/lib/db';
import { clearSession } from '@/lib/auth';
import { BUDGET_OPTIONS } from '@/lib/profile';

const ACCENTS = [
  { id: 'nimbu', color: '#D6FF3D', name: 'Nimbu' },
  { id: 'kesari', color: '#FF8A3D', name: 'Kesari' },
  { id: 'pudina', color: '#2FE3B0', name: 'Pudina' },
  { id: 'genda', color: '#FFC233', name: 'Genda' },
  { id: 'jamun', color: '#B69CFF', name: 'Jamun' },
];

export function Settings({ onClose }: { onClose(): void }) {
  const { profile, session, entries, saveProfile, setSession, reload } = useStore();
  const [theme, setTheme] = useState(document.documentElement.getAttribute('data-theme') ?? 'dark');
  const [accent, setAccent] = useState(document.documentElement.getAttribute('data-accent') ?? 'nimbu');
  const [confirmWipe, setConfirmWipe] = useState(false);

  function applyTheme(next: string) {
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('hisaabi-theme', next);
    setTheme(next);
  }

  function applyAccent(next: string) {
    if (next === 'nimbu') document.documentElement.removeAttribute('data-accent');
    else document.documentElement.setAttribute('data-accent', next);
    localStorage.setItem('hisaabi-accent', next);
    setAccent(next);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ profile, entries }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hisaabi-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Sheet onClose={onClose}>
      <h2>Settings</h2>

      <div className="section-title" style={{ marginTop: 6 }}><h2 style={{ fontSize: 15 }}>Dikhawat</h2></div>
      <div className="options">
        <div className="option" style={{ animation: 'none' }}>
          <span className="o-emoji">{theme === 'light' ? '☀️' : '🌙'}</span>
          <span><span className="o-title">Theme</span><span className="o-sub">{theme === 'light' ? 'Ujla' : 'Andhera'}</span></span>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}
                  onClick={() => applyTheme(theme === 'light' ? 'dark' : 'light')}>
            Badlo
          </button>
        </div>

        <div className="option" style={{ animation: 'none' }}>
          <span className="o-emoji">🎨</span>
          <span className="grow"><span className="o-title">Rang</span><span className="o-sub">{ACCENTS.find((a) => a.id === accent)?.name}</span></span>
          <span style={{ display: 'flex', gap: 7, marginLeft: 'auto' }}>
            {ACCENTS.map((a) => (
              <button key={a.id} onClick={() => applyAccent(a.id)} aria-label={a.name}
                      style={{
                        width: 24, height: 24, borderRadius: '50%', background: a.color,
                        border: accent === a.id ? '2px solid var(--ink)' : '2px solid transparent',
                      }} />
            ))}
          </span>
        </div>
      </div>

      <div className="section-title"><h2 style={{ fontSize: 15 }}>Mahine ka budget</h2></div>
      <div className="options">
        {BUDGET_OPTIONS.map((o) => (
          <button key={o.id} className="option" style={{ animation: 'none' }}
                  data-selected={profile?.monthlyBudgetPaise === toPaise(Number(o.id))}
                  onClick={() => profile && void saveProfile({ ...profile, monthlyBudgetPaise: toPaise(Number(o.id)) })}>
            <span className="o-emoji">{o.emoji}</span>
            <span><span className="o-title">{o.title}</span></span>
          </button>
        ))}
      </div>

      <div className="section-title"><h2 style={{ fontSize: 15 }}>Tumhara data</h2></div>
      <div className="options">
        <div className="option" style={{ animation: 'none' }}>
          <span className="o-emoji">📦</span>
          <span><span className="o-title">{entries.length} entries</span>
            <span className="o-sub">{formatINR(entries.reduce((s, e) => s + (e.type === 'expense' ? e.amountPaise : 0), 0))} ab tak</span></span>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={exportJson}>Export</button>
        </div>

        <button className="option" style={{ animation: 'none' }} onClick={() => setConfirmWipe(true)}>
          <span className="o-emoji">🗑️</span>
          <span><span className="o-title" style={{ color: 'var(--bad)' }}>Sab data hata do</span>
            <span className="o-sub">Wapas nahi aayega</span></span>
        </button>
      </div>

      {confirmWipe && (
        <div className="dev-note" style={{ borderColor: 'var(--bad)' }}>
          Pakka? Saara hisaab is phone se hamesha ke liye chala jayega.
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmWipe(false)}>Rehne do</button>
            <button className="btn btn-sm" style={{ background: 'var(--bad)', color: '#fff' }}
                    onClick={async () => { await db.wipe(); clearSession(); await reload(); location.reload(); }}>
              Haan, hata do
            </button>
          </div>
        </div>
      )}

      <div className="q-foot">
        {session && (
          <button className="btn btn-ghost btn-block"
                  onClick={() => { clearSession(); setSession(null); onClose(); }}>
            Logout ({session.email})
          </button>
        )}
        <button className="btn btn-quiet btn-block" onClick={onClose}>Band karo</button>
      </div>
    </Sheet>
  );
}
