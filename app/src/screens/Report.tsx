import { useMemo } from 'react';
import { monthRange, spentBetween, formatINR, buildMoneyPlan, type CategoryId, type Entry } from '@engine';
import { Icon } from '@/components/ui';
import { useStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { catEmoji, catLabel } from '@/lib/labels';
import { loadMoneyProfile } from '@/lib/moneyProfile';

/**
 * Monthly report — ek structured financial review. Profit/loss, bachat,
 * kahan gaya, aur kaise behtar ho sakta hai. Sab deterministic, koi general baat nahi.
 */
export function Report() {
  const t = useT();
  const { entries, setRoute } = useStore();
  const now = new Date();
  const profile = useMemo(() => loadMoneyProfile(), []);
  const plan = useMemo(() => (profile ? buildMoneyPlan(profile) : null), [profile]);

  const r = useMemo(() => monthlyReport(entries, profile?.incomePaise ?? 0, now), [entries, profile, now]);

  const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MONTHS_HI = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = t(MONTHS_EN[now.getMonth()], MONTHS_HI[now.getMonth()]);

  const net = r.income - r.spent;      // + = bacha (profit), − = zyada gaya (loss)
  const profit = net >= 0;
  const savingsRate = r.income > 0 ? net / r.income : 0;
  const planNeeds = plan?.buckets.find((b) => b.id === 'needs')?.allocatedPaise ?? 0;
  const planFun = plan?.buckets.find((b) => b.id === 'fun')?.allocatedPaise ?? 0;

  const tips = buildTips({ profit, net, income: r.income, spent: r.spent, savingsRate, cats: r.cats, plan, t });

  return (
    <div className="screen report-screen">
      <header className="home-top">
        <button className="icon-btn" onClick={() => setRoute('home')} aria-label={t('Back', 'Peeche')}>{Icon.back}</button>
        <div className="grow" style={{ marginLeft: 4 }}>
          <div className="greet">{t('Monthly report', 'Mahine ki report')}</div>
          <div className="name">{monthName} {now.getFullYear()}</div>
        </div>
      </header>

      {/* profit / loss hero */}
      <div className={`rep-hero tone-${profit ? 'good' : 'bad'}`}>
        <div className="rh-k">{r.income > 0 ? (profit ? t('Saved this month', 'Is mahine bacha') : t('Overspent', 'Zyada kharch ho gaya')) : t('Spent this month', 'Is mahine kharch')}</div>
        <div className="rh-v num">{formatINR(r.income > 0 ? Math.abs(net) : r.spent)}</div>
        <div className="rh-sub">
          {r.income > 0
            ? t(`${formatINR(r.income)} came in · ${formatINR(r.spent)} spent`, `${formatINR(r.income)} aaya · ${formatINR(r.spent)} kharch`)
            : t(`${r.count} expenses`, `${r.count} kharche`)}
        </div>
        {r.income > 0 && (
          <div className="rh-split">
            <i className="rh-spent" style={{ width: `${Math.min(100, (r.spent / r.income) * 100)}%` }} />
            <i className="rh-saved" style={{ width: `${Math.max(0, Math.min(100, (net / r.income) * 100))}%` }} />
          </div>
        )}
        {r.income > 0 && (
          <div className="rh-rate">{profit
            ? t(`You kept ${Math.round(savingsRate * 100)}% of your income 💪`, `Apni kamai ka ${Math.round(savingsRate * 100)}% bacha liya 💪`)
            : t('Spending crossed your income this month', 'Kharcha is mahine kamai se zyada ho gaya')}</div>
        )}
      </div>

      {/* where it went — full category table */}
      <div className="rep-sec">{t('Where it went', 'Kahan gaya')}</div>
      {r.cats.length === 0 ? (
        <p className="rep-empty">{t('No expenses logged this month yet.', 'Is mahine abhi koi kharcha nahi.')}</p>
      ) : (
        <div className="rep-table">
          {r.cats.map((c) => (
            <div className="rep-row" key={c.category}>
              <span className="rr-label">{catEmoji(c.category)} {catLabel(c.category)}</span>
              <span className="rr-bar"><i style={{ width: `${(c.paise / Math.max(1, r.cats[0].paise)) * 100}%` }} /></span>
              <span className="rr-amt num">{formatINR(c.paise)}</span>
              <span className="rr-pct num">{Math.round((c.paise / Math.max(1, r.spent)) * 100)}%</span>
            </div>
          ))}
        </div>
      )}

      {/* vs plan */}
      {plan && (planNeeds > 0 || planFun > 0) && (
        <>
          <div className="rep-sec">{t('Plan vs reality', 'Plan vs asli')}</div>
          <div className="rep-table">
            <PlanRow emoji="🏠" label={t('Needs', 'Zaroori')} spent={r.bucket.needs} planned={planNeeds} t={t} />
            <PlanRow emoji="🎉" label={t('Fun', 'Masti')} spent={r.bucket.fun} planned={planFun} t={t} />
          </div>
        </>
      )}

      {/* how to improve */}
      <div className="rep-sec">{t('How to do better', 'Kaise behtar karein')}</div>
      <div className="rep-tips">
        {tips.map((tip, i) => (
          <div className="rep-tip" key={i}>
            <span className="rt-ico">{tip.ico}</span>
            <p>{tip.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanRow({ emoji, label, spent, planned, t }: { emoji: string; label: string; spent: number; planned: number; t: (e: string, h: string) => string }) {
  const over = spent > planned;
  const pct = planned > 0 ? Math.min(100, (spent / planned) * 100) : 0;
  return (
    <div className="rep-row">
      <span className="rr-label">{emoji} {label}</span>
      <span className="rr-bar"><i style={{ width: `${pct}%` }} data-tone={over ? 'bad' : undefined} /></span>
      <span className="rr-amt num" data-tone={over ? 'bad' : undefined}>{formatINR(spent)} / {formatINR(planned)}</span>
      <span className="rr-pct">{over ? t('over', 'zyada') : t('ok', 'theek')}</span>
    </div>
  );
}

/* ---------- report maths (deterministic) ---------- */

interface CatSpend { category: CategoryId; paise: number }

function monthlyReport(entries: Entry[], planIncome: number, now: Date) {
  const { from, to } = monthRange(now);
  const f = from.getTime();
  const tt = to.getTime();

  let incomeActual = 0;
  let count = 0;
  const byCat = new Map<CategoryId, number>();
  const bucket = { needs: 0, fun: 0, other: 0 };
  const NEEDS = new Set<CategoryId>(['rent', 'bills', 'grocery', 'travel', 'health', 'education']);
  const FUN = new Set<CategoryId>(['food', 'fun', 'shopping']);

  for (const e of entries) {
    if (e.status !== 'confirmed') continue;
    const at = new Date(e.occurredAt).getTime();
    if (at < f || at > tt) continue;
    if (e.type === 'income') { incomeActual += e.amountPaise; continue; }
    if (e.type !== 'expense') continue;
    count += 1;
    const c = (e.category ?? 'other') as CategoryId;
    byCat.set(c, (byCat.get(c) ?? 0) + e.amountPaise);
    if (NEEDS.has(c)) bucket.needs += e.amountPaise;
    else if (FUN.has(c)) bucket.fun += e.amountPaise;
    else bucket.other += e.amountPaise;
  }

  const spent = spentBetween(entries, from, to);
  const cats: CatSpend[] = [...byCat.entries()].map(([category, paise]) => ({ category, paise })).sort((a, b) => b.paise - a.paise);
  const income = incomeActual > 0 ? incomeActual : planIncome;
  return { income, spent, count, cats, bucket };
}

function buildTips({ profit, net, income, spent, savingsRate, cats, plan, t }: {
  profit: boolean; net: number; income: number; spent: number; savingsRate: number;
  cats: CatSpend[]; plan: ReturnType<typeof buildMoneyPlan> | null; t: (e: string, h: string) => string;
}): { ico: string; text: string }[] {
  const tips: { ico: string; text: string }[] = [];

  if (income > 0 && !profit) {
    tips.push({ ico: '🚨', text: t(`You spent ${formatINR(-net)} more than you earned. First stop: cut the biggest expense below.`, `Kamai se ${formatINR(-net)} zyada kharch. Sabse pehle: neeche sabse bada kharcha ghatao.`) });
  }

  const top = cats[0];
  if (top && spent > 0) {
    const cut = Math.round(top.paise * 0.15);
    tips.push({ ico: '✂️', text: t(`Biggest expense: ${catLabel(top.category)} — ${formatINR(top.paise)} (${Math.round((top.paise / spent) * 100)}%). Trim 15% → save ${formatINR(cut)}.`, `Sabse bada kharcha: ${catLabel(top.category)} — ${formatINR(top.paise)} (${Math.round((top.paise / spent) * 100)}%). 15% ghatao → ${formatINR(cut)} bachao.`) });
  }

  if (income > 0) {
    if (savingsRate < 0.1) {
      const target = Math.round(income * 0.1);
      tips.push({ ico: '🎯', text: t(`Aim to save at least 10% (${formatINR(target)}) a month. Even small helps.`, `Har mahine kam se kam 10% (${formatINR(target)}) bachao. Thoda bhi kaafi hai.`) });
    } else if (savingsRate >= 0.2) {
      tips.push({ ico: '🌟', text: t(`Strong month — you saved ${Math.round(savingsRate * 100)}%. Put extra into your emergency fund or invest.`, `Mast mahina — ${Math.round(savingsRate * 100)}% bachaya. Extra emergency fund ya invest me daalo.`) });
    }
  }

  if (plan && plan.emergencyFundPaise < plan.emergencyTargetPaise) {
    const gap = plan.emergencyTargetPaise - plan.emergencyFundPaise;
    tips.push({ ico: '🛟', text: t(`Emergency fund is ${formatINR(gap)} short of ${formatINR(plan.emergencyTargetPaise)}. Keep feeding it before big spends.`, `Emergency fund ${formatINR(plan.emergencyTargetPaise)} se ${formatINR(gap)} peeche hai. Bade kharche se pehle isme daalo.`) });
  }

  if (tips.length === 0) {
    tips.push({ ico: '👍', text: t('Nothing alarming — keep logging and the picture gets sharper.', 'Sab theek — likhte raho, tasveer aur saaf hogi.') });
  }
  return tips;
}
