import { useMemo } from 'react';
import { buildMoneyPlan, monthRange, formatINR, type CategoryId, type Entry, type MoneyPlan } from '@engine';
import { useStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { catLabel } from '@/lib/labels';
import { loadMoneyProfile, planPulse } from '@/lib/moneyProfile';
import { getBalance } from '@/lib/balance';

/**
 * Advice — "abhi jo hai, usse best kaise karo". Poori situation (kamai, jeb,
 * kharch, plan, goal) dekh kar prioritized, concrete salah. Sab deterministic.
 */
export function Advice() {
  const t = useT();
  const { entries, setRoute, budget } = useStore();
  const profile = useMemo(() => loadMoneyProfile(), []);
  const plan = useMemo(() => (profile ? buildMoneyPlan(profile) : null), [profile]);
  const pulse = useMemo(() => (plan ? planPulse(plan, entries) : null), [plan, entries]);
  const bal = getBalance();
  const income = profile?.incomePaise ?? 0;
  const spent = budget.spentThisMonthPaise;
  const topCut = useMemo(() => biggestDiscretionary(entries), [entries]);

  const advices = useMemo(
    () => (plan ? buildAdvice({ plan, pulse, income, spent, balPaise: bal?.paise ?? null, topCut, goalName: profile?.goal?.name, goalDeadline: profile?.goal?.deadlineMonths, t }) : []),
    [plan, pulse, income, spent, bal?.paise, topCut, profile, t],
  );

  return (
    <div className="screen advice-screen">
      <header className="home-top">
        <div className="grow">
          <div className="greet">{t('Your coach says', 'Coach kehta hai')}</div>
          <div className="name">{t('Make the most of it', 'Jo hai, uska best karo')}</div>
        </div>
      </header>

      {!plan ? (
        <div className="adv-empty">
          <span className="ae-ico">🦉</span>
          <p>{t('Set up your plan first, then I can give advice tuned to your money.', 'Pehle apna plan banao, phir main tumhare paise ke hisaab se salah dunga.')}</p>
          <button className="btn btn-primary" onClick={() => setRoute('plan')}>{t('Make a plan', 'Plan banao')}</button>
        </div>
      ) : (
        <div className="adv-list">
          {advices.map((a, i) => (
            <div className={`adv-card tone-${a.tone}`} key={i} style={{ animationDelay: `${i * 60}ms` }}>
              <span className="adv-ico">{a.icon}</span>
              <div className="grow">
                <b>{a.title}</b>
                <p>{a.body}</p>
              </div>
            </div>
          ))}
          <p className="plan-foot">{t('Guidance from simple money rules — not licensed financial advice.', 'Seedhe paise-niyam se salah — koi licensed financial advice nahi.')}</p>
        </div>
      )}
    </div>
  );
}

/* ---------- advice engine (deterministic, prioritized) ---------- */

interface Advice { tone: 'good' | 'info' | 'warn' | 'bad'; icon: string; title: string; body: string }

function buildAdvice({ plan, pulse, income, spent, balPaise, topCut, goalName, goalDeadline, t }: {
  plan: MoneyPlan; pulse: ReturnType<typeof planPulse> | null;
  income: number; spent: number; balPaise: number | null;
  topCut: { category: CategoryId; paise: number } | null;
  goalName?: string; goalDeadline?: number;
  t: (e: string, h: string) => string;
}): Advice[] {
  const A: Advice[] = [];
  const f = formatINR;

  // 1. kamai < zaroori kharche — sabse bada red flag
  if (plan.status === 'red' && plan.disposablePaise <= 0) {
    A.push({ tone: 'bad', icon: '🚨', title: t('Spending more than you earn', 'Kamai se zyada kharch'),
      body: t(`Your fixed costs (${f(plan.mandatoryNeedsPaise)}) already cross your income (${f(income)}). Trim the biggest fixed cost or add a small side income — this comes before anything else.`, `Fixed kharche (${f(plan.mandatoryNeedsPaise)}) hi kamai (${f(income)}) se zyada hain. Sabse bade fixed kharche ko kam karo ya thodi side-income — sab se pehle yahi.`) });
  }

  // 1.5 reality check — jo jeb me nahi, wo ja chuka
  if (balPaise !== null && income > 0 && income - balPaise > 0) {
    const used = income - balPaise;
    A.push({ tone: 'info', icon: '🧮', title: t('Reality check', 'Sachai ka hisaab'),
      body: t(`You earned ${f(income)}, and ${f(balPaise)} is in hand — so about ${f(used)} is already gone this month. Log those spends in the chat so the app knows where it went.`, `${f(income)} kamaya, ${f(balPaise)} jeb me — matlab ~${f(used)} is mahine ja chuka. Un kharcho ko chat me log karo taaki app ko pata rahe kahan gaya.`) });
  }

  // 2. mehnga loan
  if (plan.flags.includes('high_interest_debt')) {
    A.push({ tone: 'warn', icon: '💳', title: t('Clear the costly loan first', 'Pehle mehnga loan khatam karo'),
      body: t('A credit-card or personal loan charges 20–40% — way more than savings ever earn. Put every spare rupee here before you invest.', 'Card/personal loan 20–40% byaaj leta hai — bachat se kahin zyada. Invest se pehle har extra rupaya isme daalo.') });
  }

  // 3. jeb khaali ho rahi
  if (balPaise !== null && balPaise < 10000) {
    A.push({ tone: 'bad', icon: '👛', title: t('Cash is running low', 'Jeb khaali ho rahi'),
      body: t(`Only ${f(balPaise)} in hand. Stick to essentials till your next income — skip fun spends for now.`, `Jeb me sirf ${f(balPaise)}. Agli kamai tak sirf zaroori kharch — abhi masti chhod do.`) });
  }

  // 4. fun overspend
  if (pulse && pulse.overspentPaise > 0) {
    A.push({ tone: 'warn', icon: '🎉', title: t('Fun budget is over', 'Masti budget khatam'),
      body: t(`You're ${f(pulse.overspentPaise)} past this month's fun budget. Pause fun spends till next month so your goal stays on track.`, `Is mahine masti-budget se ${f(pulse.overspentPaise)} upar. Agle mahine tak masti roko — goal patri pe rahe.`) });
  }

  // 5. sabse aasaan bachat — biggest discretionary
  if (topCut && topCut.paise > 0 && spent > 0) {
    const cut = Math.round(topCut.paise * 0.2);
    A.push({ tone: 'info', icon: '✂️', title: t('Easiest place to save', 'Sabse aasaan bachat'),
      body: t(`Most of your flexible spend is ${catLabel(topCut.category)} — ${f(topCut.paise)}. Trim it ~20% and you keep ${f(cut)} more, without touching essentials.`, `Sabse zyada flexible kharcha ${catLabel(topCut.category)} me — ${f(topCut.paise)}. ~20% kaato to ${f(cut)} aur bachega, zaroori kharche ko chhue bina.`) });
  }

  // 6. emergency fund
  if (plan.emergencyFundPaise < plan.emergencyTargetPaise) {
    const gap = plan.emergencyTargetPaise - plan.emergencyFundPaise;
    const months = plan.emergencyMonthsToFull;
    A.push({ tone: 'info', icon: '🛟', title: t('Build your safety net', 'Safety net banao'),
      body: months
        ? t(`Keep feeding your emergency fund — ${f(gap)} to go, full in about ${months} months. One job loss or medical bill, and this is what saves you.`, `Emergency fund me daalte raho — ${f(gap)} baaki, ~${months} mahine me poora. Naukri chhoote ya medical bill aaye, yahi bachayega.`)
        : t(`Start an emergency fund — aim for ${f(plan.emergencyTargetPaise)}. Even ${f(Math.round(plan.emergencyTargetPaise / 12))} a month gets you there in a year.`, `Emergency fund shuru karo — ${f(plan.emergencyTargetPaise)} tak. Mahine ${f(Math.round(plan.emergencyTargetPaise / 12))} bhi daalo to saal me ho jayega.`) });
  }

  // 7. goal peeche
  if (goalDeadline && plan.goalMonthlyNeededPaise > 0 && plan.goalRealisticMonths && plan.goalRealisticMonths > goalDeadline) {
    A.push({ tone: 'info', icon: '🎯', title: t('Your goal needs a tweak', 'Goal ko thoda badlo'),
      body: t(`To hit ${goalName ?? 'your goal'} in ${goalDeadline} months you'd need ${f(plan.goalMonthlyNeededPaise)}/mo, but ${f(plan.goalMonthlyPlannedPaise)} fits right now. Either give it ~${plan.goalRealisticMonths} months, or free up a spend.`, `${goalName ?? 'Goal'} ${goalDeadline} mahine me chahiye to ${f(plan.goalMonthlyNeededPaise)}/mahina, par abhi ${f(plan.goalMonthlyPlannedPaise)} fit hota. Ya ~${plan.goalRealisticMonths} mahine do, ya koi kharcha kaato.`) });
  }

  // 8. sab theek — positive push
  if (A.length === 0 || plan.flags.includes('golden')) {
    A.push({ tone: 'good', icon: '🌟', title: t("You're in good shape", 'Sab badhiya chal raha'),
      body: t('Your plan is healthy. Put any spare money into your emergency fund or a simple monthly SIP — small, steady, automatic beats big and irregular.', 'Tumhara plan healthy hai. Extra paisa emergency fund ya ek simple monthly SIP me daalo — thoda-thoda lagataar, bade irregular se behtar hai.') });
  }

  return A;
}

function biggestDiscretionary(entries: Entry[]): { category: CategoryId; paise: number } | null {
  const { from, to } = monthRange(new Date());
  const disc = new Set<CategoryId>(['food', 'fun', 'shopping']);
  const by = new Map<CategoryId, number>();
  for (const e of entries) {
    if (e.status !== 'confirmed' || e.type !== 'expense') continue;
    const at = new Date(e.occurredAt).getTime();
    if (at < from.getTime() || at > to.getTime()) continue;
    const c = (e.category ?? 'other') as CategoryId;
    if (!disc.has(c)) continue;
    by.set(c, (by.get(c) ?? 0) + e.amountPaise);
  }
  let top: { category: CategoryId; paise: number } | null = null;
  for (const [category, paise] of by) if (!top || paise > top.paise) top = { category, paise };
  return top;
}
