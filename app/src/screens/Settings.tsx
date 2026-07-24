import { useEffect, useState } from 'react';
import { formatINR, toPaise } from '@engine';
import { Sheet } from '@/components/ui';
import { Lock } from '@/screens/Lock';
import { useStore } from '@/lib/store';
import { db } from '@/lib/db';
import { useT, useLang, setLang } from '@/lib/i18n';
import { hasLock, removeLock } from '@/lib/lock';
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
  const t = useT();
  const lang = useLang();
  const { profile, entries, trips, ai, saveProfile, reload } = useStore();
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
  const [pinOn, setPinOn] = useState(() => hasLock());
  const [pinFlow, setPinFlow] = useState(false);

  useEffect(() => { void captureStatus().then(setCapture); }, []);
  useEffect(() => { void nudgeStatus().then(setNudge); }, []);

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

  function togglePin() {
    if (pinOn) { removeLock(); setPinOn(false); }
    else setPinFlow(true);
  }

  async function backupNow() {
    setBusy(true);
    const res = await saveBackup(buildBackup({ profile, entries, trips }));
    setBusy(false);
    if (res !== 'failed') setLastBackup(lastBackupAt());
  }

  async function restore(file: File) {
    const data = parseBackup(await file.text());
    if (!data) { setRestoreMsg(t("This doesn't look like a Hisaabi backup file.", 'Ye Hisaabi ki backup file nahi lagti.')); return; }

    const mine = new Set(entries.map((e) => e.id));
    const fresh = data.entries.filter((e) => !mine.has(e.id));

    if (fresh.length) await db.putEntries(fresh);
    if (data.profile && !profile) await db.setMeta('profile', data.profile);
    for (const tr of data.trips ?? []) await db.putTrip(tr);

    await reload();
    setRestoreMsg(fresh.length
      ? t(`${fresh.length} entries restored ✅`, `${fresh.length} entries wapas aa gayi ✅`)
      : t('Everything was already here — nothing new.', 'Sab kuch pehle se tha — kuch naya nahi mila.'));
  }

  if (pinFlow) {
    return (
      <div className="lock-overlay">
        <Lock mode="set"
              onDone={() => { setPinFlow(false); setPinOn(true); }}
              onSkip={() => setPinFlow(false)} />
      </div>
    );
  }

  return (
    <Sheet onClose={onClose}>
      <h2>{t('Settings', 'Settings')}</h2>

      <div className="section-title"><h2 style={{ fontSize: 15 }}>{t('Language', 'Bhasha')}</h2></div>
      <div className="seg">
        <button data-on={lang === 'en'} onClick={() => setLang('en')}>English</button>
        <button data-on={lang === 'hi'} onClick={() => setLang('hi')}>हिंदी (Hinglish)</button>
      </div>

      <div className="section-title" style={{ marginTop: 6 }}><h2 style={{ fontSize: 15 }}>{t('Appearance', 'Dikhawat')}</h2></div>
      <div className="options">
        <div className="option" style={{ animation: 'none' }}>
          <span className="o-emoji">{theme === 'light' ? '☀️' : '🌙'}</span>
          <span><span className="o-title">{t('Theme', 'Theme')}</span>
            <span className="o-sub">{theme === 'light' ? t('Light', 'Ujla') : t('Dark', 'Andhera')}</span></span>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}
                  onClick={() => applyTheme(theme === 'light' ? 'dark' : 'light')}>
            {t('Switch', 'Badlo')}
          </button>
        </div>

        <div className="option" style={{ animation: 'none' }}>
          <span className="o-emoji">🎨</span>
          <span className="grow"><span className="o-title">{t('Accent', 'Rang')}</span>
            <span className="o-sub">{ACCENTS.find((a) => a.id === accent)?.name}</span></span>
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

      <div className="section-title"><h2 style={{ fontSize: 15 }}>{t('App lock', 'App lock')}</h2></div>
      <div className="options">
        <div className="option" style={{ animation: 'none' }}>
          <span className="o-emoji">{pinOn ? '🔒' : '🔓'}</span>
          <span className="grow">
            <span className="o-title">{t('PIN lock', 'PIN lock')}</span>
            <span className="o-sub">
              {pinOn
                ? t('Asks for a 4-digit PIN when the app opens.', 'App khulte hi 4-ank ka PIN maangta hai.')
                : t('Keep your money private if someone else picks up your phone.', 'Kisi aur ne phone uthaya to hisaab na dikhe.')}
            </span>
          </span>
          <button className={`toggle ${pinOn ? 'on' : ''}`} onClick={togglePin} aria-label={t('PIN on/off', 'PIN on/off')}><i /></button>
        </div>
      </div>

      <div className="section-title"><h2 style={{ fontSize: 15 }}>{t('Nightly recap', 'Raat ka hisaab')}</h2></div>
      <div className="options">
        <div className="option" style={{ animation: 'none' }}>
          <span className="o-emoji">🌙</span>
          <span className="grow">
            <span className="o-title">{t('One-line daily summary', 'Roz ek line ka summary')}</span>
            <span className="o-sub">
              {nudge === 'unsupported'
                ? t('Works in the Android app', 'Android app me chalta hai')
                : nudgeOn
                  ? t(`Every day at ${hourLabel(nudgeHour, lang)} — spent today, safe tomorrow`, `Roz ${hourLabel(nudgeHour, lang)} — aaj kitna gaya, kal kitna safe hai`)
                  : t('Off. This is what builds the habit — better to keep it on.', 'Band hai. Isi se aadat banti hai — chalu rakhna behtar hai.')}
            </span>
          </span>
          {nudge !== 'unsupported' && (
            <button className={`toggle ${nudgeOn ? 'on' : ''}`} onClick={() => void applyNudge(!nudgeOn, nudgeHour)}
                    aria-label={t('Summary on/off', 'Summary on/off')}><i /></button>
          )}
        </div>

        {nudge !== 'unsupported' && nudgeOn && (
          <div className="option" style={{ animation: 'none' }}>
            <span className="o-emoji">⏰</span>
            <span className="grow"><span className="o-title">{t('What time', 'Kis waqt')}</span></span>
            <span style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              {[20, 21, 22].map((h) => (
                <button key={h} className="chip-p" data-on={nudgeHour === h}
                        onClick={() => void applyNudge(true, h)}>{hourLabel(h, lang)}</button>
              ))}
            </span>
          </div>
        )}
      </div>

      <div className="section-title"><h2 style={{ fontSize: 15 }}>{t('Auto-capture', 'Auto-capture')}</h2></div>
      <div className="options">
        <div className="option" style={{ animation: 'none' }}>
          <span className="o-emoji">{capture === 'granted' ? '📲' : capture === 'denied' ? '🔕' : '🌐'}</span>
          <span>
            <span className="o-title">
              {capture === 'granted' ? t('On', 'Chalu hai') : capture === 'denied' ? t('Needs permission', 'Permission chahiye') : t('Not in this build', 'Is build me nahi hai')}
            </span>
            <span className="o-sub">
              {capture === 'granted'
                ? t('UPI/bank notifications turn into entries in your Review Inbox.', 'UPI/bank notifications se entries khud Review Inbox me aati hain.')
                : capture === 'denied'
                  ? t('Give notification access — only money notifications are read, and only on your phone.', 'Notification access do — sirf paise wale notifications padhe jate hain, wo bhi phone ke andar.')
                  : t('Auto-capture is a separate build (on the website download card). Play Protect blocks it, so the normal build leaves it out.', 'Auto-capture wali alag build hai (website pe download card me). Play Protect usse rokta hai, isliye normal build me wo feature rakha hi nahi gaya.')}
            </span>
          </span>
          {capture === 'denied' && (
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}
                    onClick={() => void openCaptureSettings()}>
              {t('Give', 'Do')}
            </button>
          )}
        </div>
      </div>

      <div className="section-title"><h2 style={{ fontSize: 15 }}>{t('AI brain', 'AI dimaag')}</h2></div>
      <div className="options">
        <div className="option" style={{ animation: 'none' }}>
          <span className="o-emoji">{ai.status === 'on' ? '🧠' : ai.status === 'checking' ? '⏳' : '🔌'}</span>
          <span>
            <span className="o-title">
              {ai.status === 'on' ? t(`AI is on · ${ai.provider}`, `AI on hai · ${ai.provider}`) : ai.status === 'checking' ? t('Checking…', 'Dekh raha hoon…') : t('AI is off', 'AI abhi off hai')}
            </span>
            <span className="o-sub">
              {ai.status === 'on'
                ? t('Messy lines go to AI. Clean lines are handled by rules.', 'Ulti-seedhi lines AI samjhega. Saaf lines rules hi handle karte hain.')
                : t('Rules handle everything — lines like "chai bees" don\'t need AI.', 'Rules se sab chal raha hai — "chai bees" jaisi lines ko AI ki zaroorat hi nahi.')}
            </span>
          </span>
        </div>
      </div>

      <div className="section-title"><h2 style={{ fontSize: 15 }}>{t('Monthly budget', 'Mahine ka budget')}</h2></div>
      <div className="options">
        {BUDGET_OPTIONS.map((o) => (
          <button key={o.id} className="option" style={{ animation: 'none' }}
                  data-selected={profile?.monthlyBudgetPaise === toPaise(Number(o.id))}
                  onClick={() => profile && void saveProfile({ ...profile, monthlyBudgetPaise: toPaise(Number(o.id)) })}>
            <span className="o-emoji">{o.emoji}</span>
            <span><span className="o-title">{t(o.title, o.titleHi ?? o.title)}</span></span>
          </button>
        ))}
      </div>

      <div className="section-title"><h2 style={{ fontSize: 15 }}>{t('Backup', 'Backup')}</h2></div>
      <div className="options">
        <div className="option" style={{ animation: 'none' }}>
          <span className="o-emoji">{lastBackup ? '💾' : '⚠️'}</span>
          <span className="grow">
            <span className="o-title">{lastBackup ? t('Take a backup', 'Backup le lo') : t('No backup yet', 'Abhi tak backup nahi liya')}</span>
            <span className="o-sub">
              {lastBackup
                ? t(`Last time on ${lastBackup.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}. No sync yet — lose the phone, lose it all.`, `Pichhli baar ${lastBackup.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ko. Sync abhi nahi hai — phone kho gaya to sab chala jayega.`)
                : t('Everything is only on this phone. Make a file and WhatsApp it to yourself — 5 seconds.', 'Sab kuch sirf is phone me hai. File bana ke khud ko WhatsApp kar do — 5 second ka kaam.')}
            </span>
          </span>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}
                  disabled={busy} onClick={() => void backupNow()}>
            {busy ? '…' : t('Take', 'Lo')}
          </button>
        </div>

        <label className="option" style={{ animation: 'none', cursor: 'pointer' }}>
          <span className="o-emoji">📥</span>
          <span className="grow">
            <span className="o-title">{t('Restore a backup', 'Backup wapas laao')}</span>
            <span className="o-sub">{t('Old entries get added back. What you have now stays.', 'Purani entries jud jayengi. Jo abhi hai wo hategi nahi.')}</span>
          </span>
          <input type="file" accept="application/json,.json" style={{ display: 'none' }}
                 onChange={(e) => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = ''; }} />
        </label>
      </div>

      {restoreMsg && <div className="dev-note">{restoreMsg}</div>}

      <div className="section-title"><h2 style={{ fontSize: 15 }}>{t('Your data', 'Tumhara data')}</h2></div>
      <div className="options">
        <div className="option" style={{ animation: 'none' }}>
          <span className="o-emoji">📦</span>
          <span className="grow"><span className="o-title">{t(`${entries.length} entries`, `${entries.length} entries`)}</span>
            <span className="o-sub">{t(`${formatINR(entries.reduce((s, e) => s + (e.type === 'expense' ? e.amountPaise : 0), 0))} so far`, `${formatINR(entries.reduce((s, e) => s + (e.type === 'expense' ? e.amountPaise : 0), 0))} ab tak`)}</span></span>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}
                  onClick={() => downloadCsv(entries)}>CSV</button>
        </div>

        <button className="option" style={{ animation: 'none' }} onClick={() => setConfirmWipe(true)}>
          <span className="o-emoji">🗑️</span>
          <span><span className="o-title" style={{ color: 'var(--bad)' }}>{t('Delete all data', 'Sab data hata do')}</span>
            <span className="o-sub">{t("Can't be undone", 'Wapas nahi aayega')}</span></span>
        </button>
      </div>

      {confirmWipe && (
        <div className="dev-note" style={{ borderColor: 'var(--bad)' }}>
          {t('Sure? Every bit of your data leaves this phone forever.', 'Pakka? Saara hisaab is phone se hamesha ke liye chala jayega.')}
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmWipe(false)}>{t('Keep it', 'Rehne do')}</button>
            <button className="btn btn-sm" style={{ background: 'var(--bad)', color: '#fff' }}
                    onClick={async () => { await db.wipe(); removeLock(); await reload(); location.reload(); }}>
              {t('Yes, delete', 'Haan, hata do')}
            </button>
          </div>
        </div>
      )}

      <div className="q-foot">
        <button className="btn btn-quiet btn-block" onClick={onClose}>{t('Close', 'Band karo')}</button>
      </div>
    </Sheet>
  );
}

/** 21 → "9 PM" / "9 baje" */
function hourLabel(h: number, lang: 'en' | 'hi'): string {
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return lang === 'hi' ? `${twelve} baje` : `${twelve} ${h < 12 ? 'AM' : 'PM'}`;
}
