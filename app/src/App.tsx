import { useState } from 'react';
import { StoreProvider, useStore } from '@/lib/store';
import { saveSession, type Session } from '@/lib/auth';
import { Onboarding } from '@/screens/Onboarding';
import { Auth } from '@/screens/Auth';
import { Home } from '@/screens/Home';
import type { Profile } from '@/lib/profile';
import { isDemo } from '@/lib/demo';

export default function App() {
  return (
    <StoreProvider>
      <div className="app">
        <Flow />
      </div>
    </StoreProvider>
  );
}

/**
 * Boot → onboarding → auth → app.
 * Auth skip kiya ja sakta hai: bina account ke bhi poori app chalti hai.
 */
function Flow() {
  const { ready, profile, session, saveProfile, setSession } = useStore();
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
    return <Onboarding onDone={(p: Profile) => void saveProfile(p)} />;
  }

  if (!session && !authSkipped) {
    return (
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
    );
  }

  return <Home />;
}
