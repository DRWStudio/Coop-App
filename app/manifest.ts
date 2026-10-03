import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Cooperative Savings & Credit Society',
    short_name: 'CoopSavings',
    description: 'Cooperative savings, dedicated virtual accounts, and transparent financial ledger.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#064e3b',
    theme_color: '#059669',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}