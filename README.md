# Français — French Study App

Interactive French language study app with spaced repetition, offline-first PWA support, and mobile deployment via Capacitor.

## Tech Stack

- **Vite** + **React 19** + **TypeScript**
- **React Router v6**
- **Tailwind CSS** + PostCSS
- **Supabase** (Auth + backend)
- **Workbox** (PWA service worker via vite-plugin-pwa)
- **Dexie.js** (IndexedDB for offline)
- **Capacitor** (iOS / Android deployment)

## Getting Started

```bash
npm install
npm run dev
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Lint source code |
| `npm run capacitor:sync` | Sync Capacitor native project |
| `npm run capacitor:open:ios` | Open iOS project in Xcode |
| `npm run capacitor:open:android` | Open Android project in Android Studio |

## Prerequisites for Mobile Build

Before adding native platforms, ensure:
1. **iOS**: Xcode 16+ on macOS
2. **Android**: Android Studio, JDK 17+, Android SDK 34+

```bash
# After initial scaffold:
npx cap add ios
npx cap add android
```

## Environment Variables

Configure in `.env` (not committed):

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `VITE_APPLE_CLIENT_ID` | Apple OAuth service ID |

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/          # Route pages
├── hooks/          # Custom React hooks
├── lib/            # Library configs (supabase, db, i18n)
├── App.tsx         # Root routes
└── main.tsx        # Entry point
```
