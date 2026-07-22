import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.hisaabi',
  appName: 'Hisaabi',
  webDir: 'dist',
  android: {
    // WebView me hi app chalti hai — background rangat theme ke hisaab se
    backgroundColor: '#0A0B0D',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
