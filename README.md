# Lighthouse Lekki — Estate Access Codes (v1 design)

Mobile-first PWA for a gated estate: residents create 6-digit visitor codes, guards verify them at the gate, the Estate Manager oversees everything.

**Stack:** Vite + React + TypeScript + Tailwind v4 + react-router-dom v6 (Supabase to be wired next).

## Run it
```
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
npm test
```

## Status
This is the **design prototype** with mock data (`src/mock/`). Screens: login, register, pending, home, create code, code created, hadith, change PIN, guard login/verify/verdicts (access, expired, denied), manager login/approvals/residents/guards.
Nothing here talks to a database yet.

## Roadmap
- Stage 1: wire register → approve → login → create Guest code → guard verify to Supabase (SQL already in the Supabase project), plus Share and conveniences.
- Stage 2: announcements, SOS, push and email notifications.
- Stage 3: Long Stay codes. Stage 4: Employee codes and Estate Manager overrides. Stage 5: analytics.

## Must do before go-live
- Lock a house out after repeated wrong PINs.
- Reject easy PINs (123456, 111111, 654321, repeated digits, straight sequences).
- Have a scholar verify every hadith marked VERIFY in the library.
