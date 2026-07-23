import { useEffect, useState } from 'react';
import { formatINR, toPaise } from '@engine';
import { Sheet } from '@/components/ui';
import { useStore } from '@/lib/store';
import { db } from '@/lib/db';
import { clearSession } from '@/lib/auth';
import { BUDGET_OPTIONS } from '@/lib/profile';
import { captureStatus, openCaptureSettings, type CaptureStatus } from '@/lib/capture';
import {
  askNudgePermission, cancelNightlySummary, nudgeSettings, nudgeStatus,
  saveNudgeSettings, scheduleNightlySummary, type NudgeStatus,
} from '@/lib/nudge';
import { buildBackup, downloadCsv, lastBackupAt, parseBackup, saveBackup } from '@/lib/backup';

const ACCENTS = [
  { id: 'nimbu', color: '#D6FF3D', name: 'Nimbu' },
  { id: 'kesari', color: '#FF8A3D', name: 'Kesari' },
  { id: 'pudina', color: '#2FE3B0', name: 'Pudina' },
  { id: 'genda', color: '#FFC233', name: 'Genda' },
  { id: 'jamun', color: '#B69CFF', name: 'Jamun' },
];

export function Settings({ onClose }: { onClose(): void }) {
  const { profile, session, entries, trips, ai, saveProfile, setSession, reload } = useStore();
  const [theme, setTheme] = useState(document.documentElement.getAttribute('data-theme') ?? 'dark');
  const [accent, setAccent] = useState(document.documentElement.getAttribute('data-accent') ?? 'nimbu');
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastBackup, setLastBackup] = useState(() => lastBackupAt());
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const [capture, setCapture] = useState<CaptureStatus>('unsupported');
  const [nudge, setNudge] = useState<NudgeStatus>('unsupported');
  const [nudgeOn, setNudgeOn] = useState(() => nudgeSettings().on);
  const [nudgeHour, setNudgeHour] = useState(() => nudgeSettings().hour);

  useEffect(() => { void captureStatus().then(setCapture); }, []);
  useEffect(() => { void nudgeStatus().then(setNudge); }, []);

  /** Toggle ya waqt badla — turant naye notification laga do. */
  async function applyNudge(on: boolean, hour: number) {
    setNudgeOn(on);
    setNudgeHour(hour);
    saveNudgeSettings({ on, hour });

    if (!on) { await cancelNightlySummary(); return; }

    if (nudge !== 'granted') {
      const next = await askNudgePermission();
      setNudge(next);
      if (next !== 'granted') return;
    }

    if (profile) {
      await scheduleNightlySummary({
        entries, monthlyBudgetPaise: profile.monthlyBudgetPaise, name: profile.name, hour,
      });
    }
  }

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

  async function backupNow() {
    setBusy(true);
    const res = await saveBackup(buildBackup({ profile, entries, trips }));
    setBusy(false);
    if (res !== 'failed') setLastBackup(lastBackupAt());
  }

  /** Backup file wapas laao — purani entries jud jayengi, hategi nahi. */
  async function restore(file: File) {
    const data = parseBackup(await file.text());
    if (!data) { setRestoreMsg('Ye Hisaabi ki backup file nahi lagti.'); return; }

    const mine = new Set(entries.map((e) => e.id));
    const fresh = data.entries.filter((e) => !mine.has(e.id));

    if (fresh.length) await db.putEntries(fresh);
    if (data.profile && !profile) await db.setMeta('profile', data.profile);
    for (const t of data.trips ?? []) await db.putTrip(t);

    await reload();
    setRestoreMsg(fresh.length ? `${fresh.length} entries wapas aa gayi ✅` : 'Sab kuch pehle se tha — kuch naya nahi mila.');
  }

  return (
    <Sheet onClose={onClose}>
      <h2>Settings</h2>

      <div className="section-title"><h2 style={{ fontSize: 15 }}>Dikhawat</h2></div>
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

      <div className="section-title" style={{ marginTop: 6 }}><h2 style={{ fontSize: 15 }}>Raat ka hisaab</h2></div>
      <div className="options">
        <div className="option" style={{ animation: 'none' }}>
          <span className="o-emoji">🌙</span>
          <span className="grow">
            <span className="o-title">Roz ek line ka summary</span>
            <span className="o-sub">
              {nudge === 'unsupported'
                ? 'Android app me chalta hai'
                : nudgeOn
                  ? `Roz ${hourLabel(nudgeHour)} — aaj kitna gaya, kal kitna safe hai`
                  : 'Band hai. Isi se aadat banti hai — chalu rakhna behtar hai.'}
            </span>
          </span>
          {nudge !== 'unsupported' && (
            <button className={`toggle ${nudgeOn ? 'on' : ''}`} onClick={() => void applyNudge(!nudgeOn, nudgeHour)}
                    aria-label="Summary on/off"><i /></button>
          )}
        </div>

        {nudge !== 'unsupported' && nudgeOn && (
          <div className="option" style={{ animation: 'none' }}>
            <span className="o-emoji">⏰</span>
            <span className="grow"><span className="o-title">Kis waqt</span></span>
            <span style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              {[20, 21, 22].map((h) => (
                <button key={h} className="chip-p" data-on={nudgeHour === h}
                        onClick={() => void applyNudge(true, h)}>{hourLabel(h)}</button>
              ))}
            </span>
          </div>
        )}
      </div>

      <div className="section-title"><h2 style={{ fontSize: 15 }}>Auto-capture</h2></div>
      <div className="options">
        <div className="option" style={{ animation: 'none' }}>
          <span className="o-emoji">{capture === 'granted' ? '📲' : capture === 'denied' ? '🔕' : '🌐'}</span>
          <span>
            <span className="o-title">
              {capture === 'granted' ? 'Chalu hai' : capture === 'denied' ? 'Permission chahiye' : 'Is build me nahi hai'}
            </span>
            <span className="o-sub">
              {capture === 'granted'
                ? 'UPI/bank notifications se entries khud Review Inbox me aati hain.'
                : capture === 'denied'
                  ? 'Notification access do — sirf paise wale notifications padhe jate hain, wo bhi phone ke andar.'
                  : 'Auto-capture wali alag build hai (website pe download card me). Play Protect usse rokta hai, isliye normal build me wo feature rakha hi nahi gaya.'}
            </span>
          </span>
          {capture === 'denied' && (
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}
                    onClick={() => void openCaptureSettings()}>
              Do
            </button>
          )}
        </div>
      </div>

      <div className="section-title"><h2 style={{ fontSize: 15 }}>AI dimaag</h2></div>
      <div className="options">
        <div className="option" style={{ animation: 'none' }}>
          <span className="o-emoji">{ai.status === 'on' ? '🧠' : ai.status === 'checking' ? '⏳' : '🔌'}</span>
          <span>
            <span className="o-title">
              {ai.status === 'on' ? `AI on hai · ${ai.provider}` : ai.status === 'checking' ? 'Dekh raha hoon…' : 'AI abhi off hai'}
            </span>
            <span className="o-sub">
              {ai.status === 'on'
                ? 'Ulti-seedhi lines AI samjhega. Saaf lines rules hi handle karte hain.'
                : 'Rules se sab chal raha hai — "chai bees" jaisi lines ko AI ki zaroorat hi nahi.'}
            </span>
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

      <div className="section-title"><h2 style={{ fontSize: 15 }}>Backup</h2></div>
      <div className="options">
        <div className="option" style={{ animation: 'none' }}>
          <span className="o-emoji">{lastBackup ? '💾' : '⚠️'}</span>
          <span className="grow">
            <span className="o-title">{lastBackup ? 'Backup le lo' : 'Abhi tak backup nahi liya'}</span>
            <span className="o-sub">
              {lastBackup
                ? `Pichhli baar ${lastBackup.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ko. Sync abhi nahi hai — phone kho gaya to sab chala jayega.`
                : 'Sab kuch sirf is phone me hai. File bana ke khud ko WhatsApp kar do — 5 second ka kaam.'}
            </span>
          </span>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}
                  disabled={busy} onClick={() => void backupNow()}>
            {busy ? '…' : 'Lo'}
          </button>
        </div>

        <label className="option" style={{ animation: 'none', cursor: 'pointer' }}>
          <span className="o-emoji">📥</span>
          <span className="grow">
            <span className="o-title">Backup wapas laao</span>
            <span className="o-sub">Purani entries jud jayengi. Jo abhi hai wo hategi nahi.</span>
          </span>
          <input type="file" accept="application/json,.json" style={{ display: 'none' }}
                 onChange={(e) => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = ''; }} />
        </label>
      </div>

      {restoreMsg && <div className="dev-note">{restoreMsg}</div>}

      <div className="section-title"><h2 style={{ fontSize: 15 }}>Tumhara data</h2></div>
      <div className="options">
        <div className="option" style={{ animation: 'none' }}>
          <span className="o-emoji">📦</span>
          <span className="grow"><span className="o-title">{entries.length} entries</span>
            <span className="o-sub">{formatINR(entries.reduce((s, e) => s + (e.type === 'expense' ? e.amountPaise : 0), 0))} ab tak</span></span>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}
                  onClick={() => downloadCsv(entries)}>CSV</button>
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

/** 21 → "9 baje" */
function hourLabel(h: number): string {
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} baje`;
}
