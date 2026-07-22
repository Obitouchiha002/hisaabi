/**
 * Voice input — ek hi interface, do engine.
 *
 * Android app me Web Speech API hoti hi nahi (wo sirf asli Chrome browser me hai,
 * WebView me nahi). Isliye wahan native plugin chalta hai. Browser me Web Speech.
 * Dono na hon to app saaf-saaf bata deti hai ki likh ke daal do.
 */

import { SpeechRecognition } from '@capacitor-community/speech-recognition';

export type VoiceEngine = 'native' | 'web' | 'none';

export interface VoiceSession {
  stop(): Promise<void>;
}

export interface VoiceHandlers {
  onText(text: string): void;
  onEnd(): void;
  onError(message: string): void;
}

function isNative(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

function webCtor(): (new () => WebSpeech) | undefined {
  const w = window as unknown as { SpeechRecognition?: new () => WebSpeech; webkitSpeechRecognition?: new () => WebSpeech };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export async function voiceEngine(): Promise<VoiceEngine> {
  if (isNative()) {
    try {
      const res = await SpeechRecognition.available();
      if (res.available) return 'native';
    } catch {
      // plugin nahi mila — neeche web try hoga
    }
  }
  return webCtor() ? 'web' : 'none';
}

export async function startVoice(handlers: VoiceHandlers): Promise<VoiceSession | null> {
  const engine = await voiceEngine();

  if (engine === 'native') return startNative(handlers);
  if (engine === 'web') return startWeb(handlers);

  handlers.onError('Is device pe voice nahi chalta. Likh ke daal do.');
  return null;
}

/* ---------- native (Android) ---------- */

async function startNative(handlers: VoiceHandlers): Promise<VoiceSession | null> {
  try {
    const perm = await SpeechRecognition.checkPermissions();
    if (perm.speechRecognition !== 'granted') {
      const asked = await SpeechRecognition.requestPermissions();
      if (asked.speechRecognition !== 'granted') {
        handlers.onError('Mic ki permission chahiye. Settings me se de do.');
        return null;
      }
    }

    await SpeechRecognition.removeAllListeners();
    await SpeechRecognition.addListener('partialResults', (data: { matches?: string[] }) => {
      const text = data?.matches?.[0];
      if (text) handlers.onText(text);
    });
    await SpeechRecognition.addListener('listeningState', (data: { status?: string }) => {
      if (data?.status === 'stopped') handlers.onEnd();
    });

    await SpeechRecognition.start({
      language: 'hi-IN',   // Hinglish bhi isi me achha aata hai
      maxResults: 2,
      partialResults: true,
      popup: false,
    });

    return {
      async stop() {
        try {
          await SpeechRecognition.stop();
          await SpeechRecognition.removeAllListeners();
        } catch {
          // pehle hi band ho gaya to koi baat nahi
        }
      },
    };
  } catch {
    handlers.onError('Voice shuru nahi ho paya. Dobara try karo ya likh do.');
    return null;
  }
}

/* ---------- web ---------- */

interface WebSpeech {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function startWeb(handlers: VoiceHandlers): VoiceSession {
  const Ctor = webCtor()!;
  const rec = new Ctor();

  rec.lang = 'hi-IN';
  rec.interimResults = true;
  rec.continuous = false;

  rec.onresult = (e) => {
    let out = '';
    for (let i = 0; i < e.results.length; i++) out += e.results[i]![0]!.transcript;
    handlers.onText(out);
  };
  rec.onerror = () => handlers.onError('Sunai nahi diya. Dobara try karo ya likh do.');
  rec.onend = () => handlers.onEnd();

  rec.start();

  return {
    async stop() {
      try { rec.stop(); } catch { /* already stopped */ }
    },
  };
}
