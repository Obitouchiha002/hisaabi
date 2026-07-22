import { useEffect, useMemo, useRef, useState } from 'react';
import { categoryMeta, formatINR, type DraftEntry } from '@engine';
import { Sheet } from '@/components/ui';
import { useStore } from '@/lib/store';

/**
 * Likho ya bolo — dono ek hi sheet me.
 * Type karte hi engine parse karta rehta hai, taki save se pehle hi dikh jaye ki kya banega.
 * Kuch bhi chupke se save nahi hota.
 */

const HINTS = ['chai 20', 'auto saath', 'sabzi ek sau chalis', 'petrol 500', 'atm se do hazaar nikale'];

export function AddSheet({ mode, onClose, onSaved }: {
  mode: 'type' | 'voice';
  onClose(): void;
  onSaved(count: number, total: number): void;
}) {
  const { engine, commitDrafts, profile } = useStore();
  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  // type karte hi parse — bina AI ke, isliye har keystroke pe chal sakta hai
  useEffect(() => {
    let alive = true;
    if (!text.trim()) { setDrafts([]); return; }
    void engine.ingestText(text, { source: mode === 'voice' ? 'voice' : 'manual' }).then((d) => {
      if (alive) setDrafts(d);
    });
    return () => { alive = false; };
  }, [text, engine, mode]);

  useEffect(() => {
    if (mode === 'type') setTimeout(() => areaRef.current?.focus(), 320);
    else startVoice();
    return () => recRef.current?.abort?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startVoice() {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceError('Is browser me voice support nahi hai — Android app me chalega. Tab tak likh ke daal do.');
      setTimeout(() => areaRef.current?.focus(), 200);
      return;
    }

    const rec: SpeechRecognitionLike = new Ctor();
    rec.lang = 'hi-IN';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let out = '';
      for (let i = 0; i < e.results.length; i++) out += e.results[i][0].transcript;
      setText(out);
    };
    rec.onerror = () => { setVoiceError('Sunai nahi diya. Dobara try karo ya likh do.'); setListening(false); };
    rec.onend = () => setListening(false);

    recRef.current = rec;
    setListening(true);
    setVoiceError(null);
    rec.start();
  }

  const total = useMemo(
    () => drafts.filter((d) => d.type === 'expense').reduce((s, d) => s + d.amountPaise, 0),
    [drafts],
  );

  async function save() {
    if (!drafts.length) return;
    setSaving(true);
    await commitDrafts(drafts);
    onSaved(drafts.length, total);
  }

  return (
    <Sheet onClose={onClose}>
      <h2>{mode === 'voice' ? (listening ? 'Sun raha hoon…' : 'Bolo ya likho') : 'Kya kharch hua?'}</h2>

      <textarea
        ref={areaRef}
        className="compose"
        value={text}
        placeholder={`${profile?.name ? profile.name + ', e' : 'E'}k saath sab likh do — "chai 20, auto 60, sabzi 140"`}
        onChange={(e) => setText(e.target.value)}
      />

      {listening && (
        <div className="chips">
          <span className="chip"><span className="dot" /> Mic on hai — bol do</span>
        </div>
      )}
      {voiceError && <div className="dev-note">{voiceError}</div>}

      {!text && (
        <div className="hint-row">
          {HINTS.map((h) => (
            <button key={h} className="hint" type="button" onClick={() => setText(h)}>{h}</button>
          ))}
        </div>
      )}

      {drafts.length > 0 && (
        <div className="parse-out">
          {drafts.map((d, i) => {
            const meta = categoryMeta(d.category ?? 'other');
            return (
              <div className="entry" key={i} data-type={d.type} style={{ animationDelay: `${i * 45}ms` }}>
                <span className="e-ico" aria-hidden="true">{meta.emoji}</span>
                <span>
                  <span className="e-t">{d.title}</span>
                  <span className="e-s">
                    {meta.label}
                    {d.confidence < 0.6 && ' · pakka nahi, dekh lo'}
                  </span>
                </span>
                <span className="e-a num">{formatINR(d.amountPaise)}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="q-foot">
        <button className="btn btn-primary btn-block" onClick={() => void save()} disabled={!drafts.length || saving}>
          {drafts.length
            ? `${drafts.length} ${drafts.length === 1 ? 'entry' : 'entries'} add karo · ${formatINR(total)}`
            : 'Kuch likho ya bolo'}
        </button>
        <button className="btn btn-quiet btn-block" onClick={onClose}>Rehne do</button>
      </div>
    </Sheet>
  );
}

/* ---------- Web Speech API ke minimal types ---------- */

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  abort?(): void;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: () => void;
  onend: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}
