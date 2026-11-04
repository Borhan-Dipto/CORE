# CORE — Business Operating System

One platform. Every business. Complete control.

## Phase 1 (this version)
- Email + password login, forgot/reset password
- Owner creates, edits, archives and restores businesses
- Partners join only by private invite link (7-day expiry, single use, email must match)
- Partners are read-only and see only businesses they belong to (enforced by Postgres RLS)
- Profit split per business, effective-dated (history never changes), must total 100%
- Tamper-proof activity log per business
- Bangla / English toggle, mobile-friendly

## Setup
1. Supabase → SQL Editor: run `supabase/migrations/0001_foundation.sql`, then `0002_owner_membership_invite_info.sql`.
2. Create your user in Authentication → Users, then make it the owner:
   `insert into public.platform_owners (user_id) select id from auth.users where email = 'you@example.com';`
3. Environment variables (Vercel → Settings → Environment Variables), see `.env.example`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`.
4. Supabase → Authentication → URL Configuration: Site URL = your live URL; add `https://YOUR-URL/auth/callback` to Redirect URLs.

## Develop
`npm install && npm run dev` · `npm run build`

## Tests
Database security tests live in `supabase/tests/` (run with psql against a Supabase-compatible database).
