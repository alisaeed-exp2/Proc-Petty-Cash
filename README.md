# AKCC Petty Cash Management

Petty cash tracking for Al Khalejiah Catering Company / شركة الخليجية للتموين.
Next.js (App Router) · TypeScript · Tailwind v4 · Prisma + Postgres · Auth.js · next-intl (Arabic RTL / English LTR).

## Status: foundation (step 1)

Done:
- Official brand applied: colours, fonts and logos from the Al Khalejiah brand guidelines (see Branding below)
- Bilingual routing `/en`, `/ar` with `dir` and `lang` set per locale, language toggle
- Prisma schema for the full data model (`prisma/schema.prisma`), money as integer halalas
- Email + password auth, three roles (`MANAGER`, `CONTROLLER`, `AGENT`), no public sign-up
- Ledger and balance rules as pure, tested functions (`src/lib/ledger`)
- Login page (split screen, flips in Arabic) and a placeholder dashboard

Next: money flow (funding, allocations, returns), expense upload + OCR, controller review, dashboards, Excel export, email.

## Run locally

```bash
npm install
cp .env.example .env        # fill DATABASE_URL, DIRECT_URL, AUTH_SECRET (npx auth secret)
npx prisma migrate dev --name init
npm run db:seed             # users: manager@ / controller@ / agent1@akcc.local, password = SEED_PASSWORD
npm run dev
```

Tests (no install needed beyond Node 22): `npm test`

## Rules encoded in the ledger (`src/lib/ledger/balances.ts`)

- `netAllocated = allocations − returns`
- `consumed = approved expenses (+ signed adjustments)`
- `pending = submitted, awaiting review` · `unresolved = rejected, not yet fixed`
- `cashOnHand = netAllocated − consumed` · `available = cashOnHand − pending`
- `unallocatedPool = funded − allocated + returned`
- Overspend is allowed but flagged; nobody reviews their own expense; duplicates keyed on VAT no + invoice no + total.

## Branding

From the Al Khalejiah brand guidelines:

- **Colours** (tokens in `src/app/globals.css`): Ocean `#043E50` (primary, ~40% of any screen), Gold `#C7AB6E`, Copper `#C48063`, Offwhite `#E9E3DB` (~10% each). Secondary: Gray `#EEEDEB`, Peach `#E6B9A6`, Sage `#939185`, Slate `#2F3645`.
- **Fonts:** Noto Serif (English titles) and Changa (Arabic). Noto Sans is used for dense UI such as tables and forms.
- **Logos** (`public/brand/*.svg`, vectors extracted from the guidelines PDF): `emblem`, `logo-en`, `logo-ar`, `logo-bilingual`, `wordmark-en`, `wordmark-ar`, each in the default gold + ocean colourway, `-white` (for Ocean backgrounds) and `-ocean` (single colour). Use through `src/components/brand-logo.tsx`: English logo on `/en`, Arabic logo on `/ar`.
- **Logo rules from the guide:** never recolour, rotate, stretch or add shadows; keep clear space equal to the emblem's diamond; English logo sits in the left corner, Arabic in the right; on Ocean use the white version only.

## Deploy on Railway

1. New Project -> Deploy from GitHub repo -> `alisaeed-exp2/Proc-Petty-Cash`; add a **PostgreSQL** service in the same project.
2. On the web service, set variables: `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`, `DIRECT_URL` = `${{Postgres.DATABASE_URL}}`, `AUTH_SECRET` (long random string), `AUTH_TRUST_HOST` = `true`.
3. Generate the first migration locally (needs the Postgres public URL) and commit `prisma/migrations`:
   `DATABASE_URL=<public url> DIRECT_URL=<public url> npx prisma migrate dev --name init`
4. `railway.json` runs `prisma migrate deploy` before each release and health-checks `/en/login`.
5. Seed users once: `DATABASE_URL=<public url> SEED_PASSWORD=<strong password> npm run db:seed`.
6. Service -> Settings -> Networking -> Generate Domain.
