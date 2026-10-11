// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// `astro dev|build --mode emulator` verbindet die Seite mit den lokalen Firebase-Emulatoren.
const useEmulators = process.argv.includes('emulator');

const connectSources = [
  "'self'",
  'https://firestore.googleapis.com',
  'https://identitytoolkit.googleapis.com',
  'https://securetoken.googleapis.com',
  'https://firebasestorage.googleapis.com',
  'https://europe-west1-schuetzenverein-12cfa.cloudfunctions.net',
  'https://api.cloudinary.com',
  ...(useEmulators ? ['http://127.0.0.1:8080', 'http://127.0.0.1:9099', 'http://127.0.0.1:9199'] : []),
];

export default defineConfig({
  site: 'https://schuetzen-unterigling.de',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  // Astro 7 entfernt sonst Leerzeichen zwischen Inline-Elementen nach JSX-Regeln
  compressHTML: true,
  integrations: [
    react(),
    sitemap({
      filter: (page) => !/\/(vorstand|helfer)(\/|$)/.test(new URL(page).pathname),
    }),
  ],
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Fraunces',
      cssVariable: '--font-display',
      weights: ['400 700'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['Georgia', 'serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Inter',
      cssVariable: '--font-sans',
      weights: ['400 700'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
  ],
  image: {
    layout: 'constrained',
    responsiveStyles: true,
  },
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data: blob: https://res.cloudinary.com",
        "font-src 'self'",
        `connect-src ${connectSources.join(' ')}`,
        'frame-src https://www.google.com',
        "media-src 'self'",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
    },
  },
  devToolbar: {
    enabled: false,
  },
});
