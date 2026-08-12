import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from '@/lib/store';
import { Onboarding } from '@/screens/Onboarding';
import { Lock } from '@/screens/Lock';
import { CoachHome } from '@/screens/CoachHome';
import { Review } from '@/screens/Review';
import { Trips } from '@/screens/Trips';
import { TripDetail } from '@/screens/TripDetail';
import { History } from '@/screens/History';
import { Plan } from '@/screens/Plan';
import { Report } from '@/screens/Report';
import { NavBar } from '@/components/Nav';
import type { Profile } from '@/lib/profile';
import { isDemo } from '@/lib/demo';
import { hasLock } from '@/lib/lock';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { pushBackHandler } from '@/lib/back';

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <Flow />
      </StoreProvider>
    </ErrorBoundary>
  );
}

function Shell({ screen, nav, children }: { screen: string; nav?: boolean; children: React.ReactNode }) {
  return <div className="app" data-screen={screen} data-nav={nav ? 'true' : undefined}>{children}</div>;
}

const NAV_ROUTES = new Set(['home', 'plan', 'history', 'report']);

const LOCK_OFFERED = 'hisaabi-lock-offered';

/**
 * Boot → onboarding → (ek baar PIN offer) → lock → app.
 *
 * Email login hata diya: uska vaada tha "hisaab kabhi na khoye", par sync bana
 * hi nahi tha — matlab wo vaada jhootha tha. PIN wo karta hai jo sach me ho
 * sakta hai (dost ko phone diya to hisaab na dikhe), aur poora offline hai.
 * Backup ki yaad Home ke nudge se aati hai.
 */
function Flow() {
  const { ready, profile, route, setRoute, saveProfile } = useStore();

  useEffect(() => pushBackHandler(() => {
    if (route === 'home') return false;
    setRoute(route === 'trip' ? 'trips' : 'home');
    return true;
  }), [route, setRoute]);

  // PIN app khulte hi maanga jata hai; is session me khul chuka ho to dobara nahi
  const [unlocked, setUnlocked] = useState(() => isDemo() || !hasLock());
  const [lockOffered, setLockOffered] = useState(
    () => isDemo() || localStorage.getItem(LOCK_OFFERED) === '1',
  );

  function markOffered() {
    localStorage.setItem(LOCK_OFFERED, '1');
    setLockOffered(true);
    setUnlocked(true);   // abhi-abhi PIN banaya to dobara mat maango
  }

  if (!ready) {
    return (
      <div className="splash">
        <div className="mark">₹</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <Shell screen="onboarding">
        <Onboarding onDone={(p: Profile) => void saveProfile(p)} />
      </Shell>
    );
  }

  // Onboarding ke baad ek hi baar: PIN bana lo (skip bhi kar sakte ho)
  if (!lockOffered) {
    return (
      <Shell screen="lock">
        <Lock mode="set" onDone={markOffered} onSkip={markOffered} />
      </Shell>
    );
  }

  // Har launch pe: PIN lagaya hua hai to pehle wahi
  if (!unlocked) {
    return (
      <Shell screen="lock">
        <Lock mode="open" onDone={() => setUnlocked(true)} />
      </Shell>
    );
  }

  return (
    <Shell screen={route} nav={NAV_ROUTES.has(route)}>
      {route === 'review' ? <Review />
        : route === 'trips' ? <Trips />
        : route === 'trip' ? <TripDetail />
        : route === 'history' ? <History />
        : route === 'plan' ? <Plan />
        : route === 'report' ? <Report />
        : <CoachHome />}
      {NAV_ROUTES.has(route) && <NavBar />}
    </Shell>
  );
}
