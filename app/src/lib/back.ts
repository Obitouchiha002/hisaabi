/**
 * Android ka hardware/gesture back.
 *
 * Pehle History ya Trip screen pe back dabane se poori app band ho jati thi —
 * kyunki app ke andar koi history hi nahi thi, Android ne seedha exit kar diya.
 * Ye har user pehle 30 second me maar khata hai.
 *
 * Ab: koi sheet khuli ho to wo band ho, phir screen wapas Home aaye, aur
 * Home pe hi doosri baar dabane se app band ho.
 */

type Handler = () => boolean;

const stack: Handler[] = [];
let wired = false;

/**
 * Sabse upar wala handler pehle chalta hai. `true` lautaya matlab "maine
 * sambhal liya, app band mat karo".
 */
export function pushBackHandler(handler: Handler): () => void {
  stack.push(handler);
  ensureWired();
  return () => {
    const i = stack.lastIndexOf(handler);
    if (i >= 0) stack.splice(i, 1);
  };
}

function handleBack(): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i]!()) return true;
  }
  return false;
}

interface CapApp {
  addListener?(event: string, cb: () => void): unknown;
  exitApp?(): void;
}

function capApp(): CapApp | undefined {
  const cap = (window as unknown as { Capacitor?: { Plugins?: { App?: CapApp } } }).Capacitor;
  return cap?.Plugins?.App;
}

function ensureWired(): void {
  if (wired) return;
  wired = true;

  const app = capApp();

  if (app?.addListener) {
    app.addListener('backButton', () => {
      if (!handleBack()) app.exitApp?.();
    });
    return;
  }

  // Browser: back se app "band" nahi hoti, par screen wapas jani chahiye.
  // Ek dummy state rakhte hain taki back hamesha hum tak pahunche.
  history.pushState({ hisaabi: true }, '');
  window.addEventListener('popstate', () => {
    const handled = handleBack();
    if (handled) history.pushState({ hisaabi: true }, '');
    // na handle hua to browser ko apna kaam karne do (site se bahar)
  });
}
