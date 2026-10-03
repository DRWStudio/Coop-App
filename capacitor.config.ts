import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shelterapp.coop',
  appName: 'Shelter App',
  webDir: 'out',
  server: {
    url: 'https://ais-pre-honcflstp3wcnqa5wtgcdr-555298273012.europe-west3.run.app',
    cleartext: true,
  },
};

export default config;