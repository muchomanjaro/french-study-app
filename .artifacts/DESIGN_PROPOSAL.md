# French Study App — Design Proposal

## Stack Override (super-swarm defaults differ)
- Vite (not Next.js)
- React Router v6 (not Next.js App Router)
- Tailwind CSS (shadcn/ui optional)
- Supabase (same)
- Lovable hosting (not Vercel)

## Pages
1. Auth — Login/signup (Google, Apple, email via Supabase Auth)
2. Dashboard — Review queue, SRS stats
3. Exercise — Free-text input + aggressive fuzzy match
4. Results — Whole-page % score, corrections
5. Settings — Profile, preferences, cache management

## Design System
- Mobile-first (iPad primary)
- Clean, minimal French-themed aesthetic
- SRS progress indicators
- Dark/light mode
