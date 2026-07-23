/**
 * Raat ka nudge.
 *
 * Har expense app isliye chhoot jati hai kyunki wo kabhi khud nahi bulati.
 * User bhool jata hai, do din ka data adhoora reh jata hai, phir app hat jati hai.
 * Ye ek notification uss poori chain ko todta hai.
 *
 * Kaam kaise karta hai: app khulne pe agle 7 din ke notification schedule kar
 * dete hain, har ek me us waqt ka asli summary. Android ko roz app chalane ki
 * zaroorat nahi — notification pehle se system ke paas hota hai.
 * User app kholta rahega to line hamesha taza rehti hai.
 */

import { LocalNotifications } from '@capacitor/local-notifications';
import { dailySummary, type Entry } from '@engine';

const CHANNEL = 'hisaabi-daily';
const BASE_ID = 9000;
const DAYS = 7;

export type NudgeStatus = 'unsupported' | 'granted' | 'denied';

export interface NudgeSettings {
  on: boolean;
  /** 24h — default raat 9 baje */
  hour: number;
}

const KEY = 'hisaabi-nudge';

export function nudgeSettings(): NudgeSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { hour: 21, on: true, ...(JSON.parse(raw) as Partial<NudgeSettings>) };
  } catch { /* kharab data — default hi theek hai */ }
  return { on: true, hour: 21 };
}

export function saveNudgeSettings(next: NudgeSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
}

function available(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

export async function nudgeStatus(): Promise<NudgeStatus> {
  if (!available()) return 'unsupported';
  try {
    const res = await LocalNotifications.checkPermissions();
    return res.display === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

export async function askNudgePermission(): Promise<NudgeStatus> {
  if (!available()) return 'unsupported';
  try {
    const res = await LocalNotifications.requestPermissions();
    return res.display === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

/**
 * Agle 7 din ke summary schedule karo.
 *
 * Har baar poore purane hata kar naye lagate hain — warna purani (aur galat)
 * line wale notification bache reh jate hain.
 */
export async function scheduleNightlySummary(opts: {
  entries: Entry[];
  monthlyBudgetPaise: number;
  name?: string;
  hour?: number;
}): Promise<boolean> {
  if (!available()) return false;

  const settings = nudgeSettings();
  const hour = opts.hour ?? settings.hour;

  try {
    if ((await nudgeStatus()) !== 'granted') return false;
    await cancelNightlySummary();

    if (!settings.on) return false;

    await LocalNotifications.createChannel?.({
      id: CHANNEL,
      name: 'Raat ka hisaab',
      description: 'Roz raat ko ek line me din ka kharcha',
      importance: 3,
      visibility: 1,
    });

    const now = new Date();
    const list = [];

    for (let i = 0; i < DAYS; i++) {
      const at = new Date(now);
      at.setDate(at.getDate() + i);
      at.setHours(hour, 0, 0, 0);
      if (at.getTime() <= now.getTime()) continue;   // beeta hua waqt

      // Aaj ka summary abhi ke data se; aage ke din ke liye bas yaad dilana
      const summary = i === 0
        ? dailySummary({
            entries: opts.entries,
            monthlyBudgetPaise: opts.monthlyBudgetPaise,
            now: at,
            name: opts.name,
          })
        : null;

      list.push({
        id: BASE_ID + i,
        channelId: CHANNEL,
        title: summary?.title ?? 'Aaj ka hisaab',
        body: summary?.body ?? 'Ek baar dekh lo — kitna gaya, kitna bacha.',
        schedule: { at },
        smallIcon: 'ic_stat_hisaabi',
      });
    }

    if (list.length) await LocalNotifications.schedule({ notifications: list });
    return true;
  } catch {
    // notification na lag paye to app rukni nahi chahiye
    return false;
  }
}

export async function cancelNightlySummary(): Promise<void> {
  if (!available()) return;
  try {
    const pending = await LocalNotifications.getPending();
    const ours = pending.notifications.filter((n) => n.id >= BASE_ID && n.id < BASE_ID + 100);
    if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  } catch { /* kuch pending nahi tha */ }
}
