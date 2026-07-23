import { useState } from 'react';
import { StoreProvider, useStore } from '@/lib/store';
import { saveSession, type Session } from '@/lib/auth';
import { Onboarding } from '@/screens/Onboarding';
import { Auth } from '@/screens/Auth';
import { Home } from '@/screens/Home';
import { Review } from '@/screens/Review';
import { Trips } from '@/screens/Trips';
import { TripDetail } from '@/screens/TripDetail';
import type { Profile } from '@/lib/profile';
import { isDemo } from '@/lib/demo';

export default function App() {
  return (
    <StoreProvider>
      <Flow />
    </StoreProvider>
  );
}

function Shell({ screen, children }: { screen: string; children: React.ReactNode }) {
  return <div className="app" data-screen={screen}>{children}</div>;
}

/**
 * Boot → onboarding → auth → app.
 * Auth skip kiya ja sakta hai: bina account ke bhi poori app chalti hai.
 */
function Flow() {
  const { ready, profile, session, route, saveProfile, setSession } = useStore();
  const [authSkipped, setAuthSkipped] = useState(
    () => isDemo() || localStorage.getItem('hisaabi-auth-skipped') === '1',
  );

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

  if (!session && !authSkipped) {
    return (
      <Shell screen="auth">
      <Auth
        profile={profile}
        onDone={(s: Session | null) => {
          if (s) {
            saveSession(s);
            setSession(s);
          } else {
            localStorage.setItem('hisaabi-auth-skipped', '1');
            setAuthSkipped(true);
          }
        }}
      />
      </Shell>
    );
  }

  return (
    <Shell screen={route}>
      {route === 'review' ? <Review />
        : route === 'trips' ? <Trips />
        : route === 'trip' ? <TripDetail />
        : <Home />}
    </Shell>
  );
}
