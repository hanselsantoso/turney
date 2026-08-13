# Deploying Turney to turney.id

Three pieces: API + Postgres, the app (Expo web export), the landing page.

## 1. API + Postgres — Railway (recommended) or Fly.io

Railway:
1. railway.app → New Project → Deploy from GitHub → `hanselsantoso/turney`
2. Add a **PostgreSQL** service; copy its `DATABASE_URL` into the API service vars.
3. API service settings:
   - Build: Dockerfile path `apps/api/Dockerfile`
   - Vars: `DATABASE_URL`, `JWT_SECRET` (long random), `PORT=3001`,
     `CORS_ORIGIN=https://turney.id,https://app.turney.id`,
     `MIDTRANS_SERVER_KEY` (sandbox first), `MIDTRANS_IS_PRODUCTION=false`
4. First boot runs migrations automatically. Seed once via Railway shell:
   `pnpm --filter @turney/api db:seed && pnpm --filter @turney/api exec tsx src/db/seed-parts.ts`
5. Custom domain: `api.turney.id` → CNAME to the Railway domain.

## 2. App — static Expo web export on Vercel/Cloudflare Pages

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=https://api.turney.id npx expo export --platform web --output-dir dist
```
Deploy `apps/mobile/dist` (Vercel: framework "Other", output dir `dist`).
Domain: `app.turney.id` (or serve under `turney.id/app` behind a rewrite).

SPA fallback: add a rewrite of `/*` → `/index.html` for client-side routing
(each top-level route also has a pre-rendered HTML file, so deep links work
either way).

## 3. Landing — `apps/landing/index.html`

Pure static, zero build. Same Vercel/Pages project or a separate one.
Domain: `turney.id` root. Point the OPEN APP button at the app domain.

## 4. Midtrans webhook

Dashboard → Settings → Payment notification URL:
`https://api.turney.id/payments/webhook`
Sandbox keys until real money is verified end-to-end, then flip
`MIDTRANS_IS_PRODUCTION=true` with production keys.

## 5. DNS summary (turney.id)

| Record | Target |
|---|---|
| `turney.id` A/ALIAS | landing host |
| `app.turney.id` CNAME | app host |
| `api.turney.id` CNAME | Railway/Fly app |

## Native builds (later)

`eas build -p android` / `-p ios` from `apps/mobile` (needs Expo account).
Set `EXPO_PUBLIC_API_URL=https://api.turney.id` in eas.json env.
