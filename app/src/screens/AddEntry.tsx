import { useEffect, useMemo, useRef, useState } from 'react';
import { categoryMeta, formatINR, type DraftEntry } from '@engine';
import { Icon, Sheet } from '@/components/ui';
import { useStore } from '@/lib/store';
import { startVoice, voiceEngine, type VoiceSession } from '@/lib/voice';

/**
 * Kharcha likhne/bolne wali sheet.
 *
 * Do mode ek hi jagah — upar toggle se badalte hain, sheet band karke dobara
 * kholne ki zaroorat nahi. Type karte hi engine parse karta rehta hai, taki
 * save se pehle hi dikh jaye ki kya banega. Kuch bhi chupke se save nahi hota.
 */

const HINTS = ['chai 20', 'auto saath', 'sabzi ek sau chalis', 'petrol 500', 'atm se do hazaar nikale'];

type Mode = 'voice' | 'type';

export function AddSheet({ mode: initialMode, onClose, onSaved }: {
  mode: Mode;
  onClose(): void;
  onSaved(count: number, total: number): void;
}) {
  const { engine, commitDrafts, ai } = useStore();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [canVoice, setCanVoice] = useState(true);

  const areaRef = useRef<HTMLTextAreaElement>(null);
  const voiceRef = useRef<VoiceSession | null>(null);

  /* ---- parse ---- */
  useEffect(() => {
    let alive = true;
    if (!text.trim()) { setDrafts([]); setThinking(false); return; }
    setThinking(true);

    void engine.ingestText(text, { source: mode === 'voice' ? 'voice' : 'manual' }).then((d) => {
      if (!alive) return;
      setDrafts(d);
      setThinking(false);
    });

    return () => { alive = false; };
  }, [text, engine, mode]);

  useEffect(() => {
    void voiceEngine().then((e) => setCanVoice(e !== 'none'));
    if (initialMode === 'type') setTimeout(() => areaRef.current?.focus(), 320);
    else void beginVoice();
    return () => { void voiceRef.current?.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function beginVoice() {
    setMode('voice');
    setVoiceError(null);
    setListening(true);

    const session = await startVoice({
      onText: setText,
      onEnd: () => setListening(false),
      onError: (message) => {
        setVoiceError(message);
        setListening(false);
        setMode('type');
        setTimeout(() => areaRef.current?.focus(), 200);
      },
    });

    voiceRef.current = session;
    if (!session) setListening(false);
  }

  async function stopVoice() {
    await voiceRef.current?.stop();
    setListening(false);
  }

  function switchTo(next: Mode) {
    if (next === mode) return;
    if (next === 'type') {
      void stopVoice();
      setMode('type');
      setTimeout(() => areaRef.current?.focus(), 120);
    } else {
      void beginVoice();
    }
  }

  const total = useMemo(
    () => drafts.reduce((s, d) => s + (d.type === 'expense' ? d.amountPaise : 0), 0),
    [drafts],
  );

  async function save() {
    if (!drafts.length) return;
    setSaving(true);
    await stopVoice();
    await commitDrafts(drafts);
    onSaved(drafts.length, total);
  }

  return (
    <Sheet onClose={onClose}>
      {/* mode switch */}
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={mode === 'voice'} data-on={mode === 'voice'}
                onClick={() => switchTo('voice')} disabled={!canVoice}>
          {Icon.mic} Bolo
        </button>
        <button role="tab" aria-selected={mode === 'type'} data-on={mode === 'type'}
                onClick={() => switchTo('type')}>
          {Icon.keyboard} Likho
        </button>
      </div>

      {mode === 'voice' ? (
        <div className="voice-stage">
          <button className={`orb ${listening ? 'on' : ''}`} onClick={() => (listening ? void stopVoice() : void beginVoice())}
                  aria-label={listening ? 'Rok do' : 'Bolo'}>
            <span className="orb-ring" /><span className="orb-ring d2" /><span className="orb-ring d3" />
            <span className="orb-core">{Icon.mic}</span>
          </button>

          <p className="voice-hint">
            {listening ? 'Sun raha hoon… ek saath sab bol do' : text ? 'Ho gaya — neeche dekh lo' : 'Dabao aur bolo'}
          </p>

          {listening && (
            <div className="wave" aria-hidden="true">
              {Array.from({ length: 14 }, (_, i) => <i key={i} style={{ animationDelay: `${i * 60}ms` }} />)}
            </div>
          )}

          {text && <p className="transcript">“{text}”</p>}
        </div>
      ) : (
        <>
          <textarea
            ref={areaRef}
            className="compose"
            value={text}
            rows={2}
            placeholder={'Ek saath sab likh do —\n“chai 20, auto 60, sabzi 140”'}
            onChange={(e) => setText(e.target.value)}
          />
          {!text && (
            <div className="hint-row">
              {HINTS.map((h) => (
                <button key={h} className="hint" type="button" onClick={() => setText(h)}>{h}</button>
              ))}
            </div>
          )}
        </>
      )}

      {voiceError && <div className="dev-note">{voiceError}</div>}

      {/* parse ka natija */}
      {(drafts.length > 0 || thinking) && (
        <div className="parse-block">
          <div className="parse-head">
            <span className="tile-k">{thinking ? 'Samajh raha hoon…' : `${drafts.length} kharcha mila`}</span>
            {!thinking && drafts.length > 0 && <span className="parse-total num">{formatINR(total)}</span>}
          </div>

          {thinking && drafts.length === 0 ? (
            <div className="skeleton" />
          ) : (
            <div className="parse-out">
              {drafts.map((d, i) => {
                const meta = categoryMeta(d.category ?? 'other');
                return (
                  <div className="entry" key={`${d.title}-${i}`} data-type={d.type} style={{ animationDelay: `${i * 55}ms` }}>
                    <span className="e-ico" aria-hidden="true">{meta.emoji}</span>
                    <span>
                      <span className="e-t">{d.title}</span>
                      <span className="e-s">
                        {meta.label}
                        {d.warnings.includes('ai_parsed') && ' · AI ne samjha'}
                        {d.confidence < 0.6 && ' · pakka nahi, dekh lo'}
                      </span>
                    </span>
                    <span className="e-a num">{formatINR(d.amountPaise)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!text && mode === 'type' && ai.status === 'on' && (
        <p className="ai-note">{Icon.spark} AI on hai — ulta-seedha likho tab bhi samajh jayega</p>
      )}

      <div className="q-foot">
        <button className="btn btn-primary btn-block" onClick={() => void save()} disabled={!drafts.length || saving}>
          {drafts.length
            ? `${drafts.length} ${drafts.length === 1 ? 'entry' : 'entries'} add karo · ${formatINR(total)}`
            : mode === 'voice' ? 'Bolo, phir add karna' : 'Kuch likho'}
        </button>
        <button className="btn btn-quiet btn-block" onClick={onClose}>Rehne do</button>
      </div>
    </Sheet>
  );
}
