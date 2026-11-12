# DUSKNYT — Nightlife Guestlist Platform

One monorepo, one API, three installable PWAs.

| App | Folder | Local | Production |
|---|---|---|---|
| User app | `apps/user-web` | http://localhost:5173 | `dusknyt.com` |
| Promoter app | `apps/promoter-web` | http://localhost:5174 | `promoter.dusknyt.com` |
| Admin panel | `apps/admin-web` | http://localhost:5175 | `admin.dusknyt.com` |
| API (Express + Prisma) | `apps/api` | http://localhost:4000 | `api.dusknyt.com` |
| Shared | `packages/ui`, `packages/shared`, `packages/api-client` | | |

Stack: React 18 + Vite + Tailwind + TanStack Query + Zustand (web) · Node + Express + Prisma + PostgreSQL (API) · vite-plugin-pwa (PWA).

## Run locally

```bash
npm install                      # installs all workspaces and runs `prisma generate`
docker compose up -d             # PostgreSQL (or point DATABASE_URL at any Postgres)
npm run db:push                  # create tables
npm run db:seed                  # demo data
npm run dev                      # API + 3 apps together
```

`.env` files are pre-created from the `.env.example` files. Review `apps/api/.env` (`JWT_SECRET`, `DATABASE_URL`).

### Demo logins (after seeding)
| Role | Login |
|---|---|
| Admin | `admin@dusknyt.com` / `Admin@123` |
| Promoter | `9876543210` / `Promo@123` (or OTP `123456`) |
| User | phone `9999999999`, OTP `123456` (OTPs are fixed to `123456` and logged outside production) |

## How it fits together

- **Roles**: `USER`, `PROMOTER`, `ADMIN`/`SUPER_ADMIN`. JWT is sent as a Bearer token. API route groups:
  `/api/v1/...` (user), `/api/v1/promoter/...`, `/api/v1/admin/...`, each behind its own role middleware.
- **Tenant safety**: every promoter query is scoped to `req.promoter.id` (see `promoter.routes.js`).
- **Request lifecycle** lives in one place: `apps/api/src/services/guestlist.js`
  (`PENDING → CONFIRMED | REJECTED | EXPIRED`; QR code generated on confirm; notifications created automatically).
- **Promoters are created by admins** (Admin → Promoters → Add). There is no open promoter signup.
- **Design system**: colors/themes are CSS variables in `packages/ui/src/styles.css`, so dark/light works in all apps.

## Deploy (fast path)

1. **Database**: create a Postgres on Neon or Supabase → copy the connection string.
2. **API** on Render (`render.yaml` included) or Railway: set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`
   (`https://dusknyt.com,https://promoter.dusknyt.com,https://admin.dusknyt.com`). On boot it runs `prisma db push`.
   Seed once from your machine: `DATABASE_URL=<prod url> npm run db:seed` (this WIPES data — only for the very first deploy,
   and change the admin password afterwards; better: create your admin manually).
3. **Frontends** on Vercel/Cloudflare Pages — one project per app:
   Root directory `apps/user-web` (etc.), install command `cd ../.. && npm install`, build command `npm run build`,
   output `dist`, env `VITE_API_URL=https://api.dusknyt.com`. `vercel.json` handles SPA routing.
4. **DNS** (Cloudflare): `dusknyt.com`, `promoter`, `admin`, `api` → their hosts. Protect `admin.` with Cloudflare Access / IP allowlist.

## Before going live (not included)
- **SMS OTP**: wire MSG91/Twilio in `apps/api/src/services/otp.js` (OTP store is in-memory → use Redis when running >1 instance).
- **Admin 2FA** (TOTP) and refresh-token rotation; tokens are currently 7-day JWTs in localStorage.
- **Image upload**: forms take image URLs; add Cloudinary/S3 uploads.
- **Google login**: set `GOOGLE_CLIENT_ID` (API) and `VITE_GOOGLE_CLIENT_ID` (user app).
- **Migrations**: run `npx prisma migrate dev --name init` in `apps/api` and switch the start script to `prisma migrate deploy`.
- Apple Wallet pass, Web Push, payments, tests, and Sentry.
