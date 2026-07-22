/**
 * Auto-capture ka bridge.
 *
 * Android pe native plugin (NotificationListenerService) event bhejta hai;
 * yahan wahi event engine ko diya jata hai. Raw text hamesha save hota hai
 * taki parser sudhrne pe purane notifications dobara parse ho sakein.
 *
 * Web pe plugin hota hi nahi — isliye sab kuch optional hai aur
 * `simulateNotification` se testing ho jati hai.
 */

import type { DraftEntry, HisaabiEngine, RawEvent } from '@engine';
import { db, newId } from './db';

export interface NativeNotification {
  packageName?: string;
  appLabel?: string;
  title?: string;
  text?: string;
  postedAt?: number;
  /** notification ka apna id — Android kabhi-kabhi ek hi notification do baar bhejta hai */
  key?: string;
}

/** Kaunse app dekhne hain — baaki sab ignore. */
export const WATCHED_PACKAGES = [
  'com.phonepe.app',
  'com.google.android.apps.nbu.paisa.user',
  'net.one97.paytm',
  'in.org.npci.upiapp',
  'com.dreamplug.androidapp',
  'com.google.android.apps.messaging',
  'com.samsung.android.messaging',
  'com.mobikwik_new',
  'com.freecharge.android',
];

function toRawEvent(n: NativeNotification): RawEvent {
  return {
    id: newId('raw'),
    source: 'notification',
    rawText: [n.title, n.text].filter(Boolean).join(' — '),
    receivedAt: new Date(n.postedAt ?? Date.now()).toISOString(),
    meta: {
      packageName: n.packageName,
      appLabel: n.appLabel,
      title: n.title,
      body: n.text,
      externalId: n.key,
    },
  };
}

/** Ek notification ko draft me badlo (aur raw hamesha save karo). */
export async function handleNotification(
  engine: HisaabiEngine,
  n: NativeNotification,
): Promise<DraftEntry | null> {
  const event = toRawEvent(n);
  await db.putRaw(event);
  return engine.ingestNotification(event);
}

/** Web pe test karne ke liye — asli plugin ka wahi rasta. */
export function simulateNotification(
  engine: HisaabiEngine,
  text: string,
  packageName = 'com.phonepe.app',
): DraftEntry | null {
  const event: RawEvent = {
    id: newId('raw'),
    source: 'notification',
    rawText: text,
    receivedAt: new Date().toISOString(),
    meta: { packageName },
  };
  void db.putRaw(event);
  return engine.ingestNotification(event);
}

/* ---------- native bridge ---------- */

interface CapturePlugin {
  addListener?(event: string, cb: (data: NativeNotification) => void): unknown;
  hasPermission?(): Promise<{ granted: boolean; supported?: boolean }>;
  openSettings?(): Promise<void>;
}

interface CapacitorLike {
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, CapturePlugin>;
}

function capacitor(): CapacitorLike | undefined {
  return (window as unknown as { Capacitor?: CapacitorLike }).Capacitor;
}

export function isNative(): boolean {
  return capacitor()?.isNativePlatform?.() === true;
}

/**
 * Native listener chalu karo. Web pe kuch nahi hota.
 * Return: cleanup function.
 */
export function startNativeCapture(onNotification: (n: NativeNotification) => void): () => void {
  const plugin = capacitor()?.Plugins?.HisaabiCapture;
  if (!plugin?.addListener) return () => {};

  const handle = plugin.addListener('notification', (data) => {
    if (data?.packageName && !WATCHED_PACKAGES.includes(data.packageName)) return;
    onNotification(data);
  }) as { remove?: () => void } | undefined;

  return () => handle?.remove?.();
}

/* ---------- permission ---------- */

export type CaptureStatus = 'unsupported' | 'granted' | 'denied';

/**
 * Notification access sirf system screen se milta hai — app runtime dialog
 * nahi dikha sakti. Isliye status padhkar user ko wahin bhejte hain.
 */
export async function captureStatus(): Promise<CaptureStatus> {
  const plugin = capacitor()?.Plugins?.HisaabiCapture;
  if (!plugin?.hasPermission) return 'unsupported';
  try {
    const res = await plugin.hasPermission();
    // lite build me service hoti hi nahi — wahan permission maangna bekaar hai
    if (res?.supported === false) return 'unsupported';
    return res?.granted ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

export async function openCaptureSettings(): Promise<void> {
  await capacitor()?.Plugins?.HisaabiCapture?.openSettings?.();
}
