# FixTrack

A fresh green repair workspace built with **Vite, React, TypeScript, and Supabase**. The original `../repairflow/` project is untouched.

**Current defense setup: Vercel + Supabase Cloud.** Follow [CLOUD_SETUP.md](CLOUD_SETUP.md) for the exact environment fields, cloud deployment, real test accounts, and verification. This route does not need Docker or LAN sharing. The local-stack instructions below remain an optional development path.

## Open the local preview

From this directory:

```powershell
npm.cmd install
npm.cmd run dev
```

Open **http://127.0.0.1:5173**. Node 22.12+ or a compatible newer release is required.

With both Supabase browser values empty, the development server runs in **sample-data preview mode**. It has no real accounts, uses browser local storage, and must only contain fictional information. Partial configuration and deployed builds never open the sample workspace: they show a setup screen until the Supabase settings are valid. There is no secret demo admin password.

For customer tracking, open `/track`, choose **Try a sample repair**, or enter `FX-1048` and `GREEN-2026`. New preview repairs receive their own generated code. Settings lets you reset preview edits.

## What is implemented

- Responsive green dashboard, actual queue counts, upcoming commitments, and working dashboard links.
- Repair queue with search, stage/overdue filters, pagination, and individual URLs.
- Intake with new/existing customers, separate internal/customer-safe issue fields, optional estimates, and private-code issuance.
- Persistent preview data; a separate Supabase adapter with no silent fallback when a configured backend fails.
- Repair stages, activity history, internal/customer-visible updates, original/revised estimates, delay explanations, and collection confirmation.
- Customers, collected repair history, saved shop settings, and code replacement.
- Admin-only note removal with a confirmation dialog. Staff cannot remove notes; status and schedule events cannot be removed. Removed notes are retained in a private administrative audit table and disappear from staff/customer timelines.
- Supabase sign-in, invitation/password setup, password recovery, TOTP enrollment/challenge, staff invitations, and access deactivation.
- Private tracking Edge Function with a limited response and shared database rate limits.
- SQL schema, RLS policies, protected transactional RPCs, unique references, duplicate-intake protection, version checks, and audited changes.
- Locally bundled fonts: no Google Fonts or third-party analytics requests.

## Enable real local accounts and database

**Docker Desktop is required for local Supabase on this Windows machine. It was not installed when the app was built.** The Supabase stack, email delivery, and Edge Functions have therefore not been run together here yet.

1. Install Docker Desktop, enable its required virtualization/WSL components, and start Docker. This is a separate system setup step and may require a restart.
2. Start Supabase and apply migrations:

   ```powershell
   npm.cmd run db:start
   npm.cmd run db:migrate
   ```

3. Copy `.env.example` to `.env.local`. Run `npx.cmd supabase status` and enter the local API URL and publishable key (or legacy anon key) in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Set `APP_URL=http://127.0.0.1:5173`. For owner provisioning, also set the local server secret key in `SUPABASE_SECRET_KEY`, or the legacy service-role key in `SUPABASE_SERVICE_ROLE_KEY`. Never put privileged values in `VITE_` variables or commit them.
4. Copy `supabase/.env.local.example` to `supabase/.env.local`. In another terminal run:

   ```powershell
   npm.cmd run functions:serve
   ```

5. Create the first owner and shop:

   ```powershell
   npm.cmd run setup:owner
   ```

   Enter the owner and shop details at the prompts. There is no default password. Open local Mailpit at **http://127.0.0.1:54324**, follow the invitation, and set a password of at least 12 characters. Local emails are captured here rather than sent to real inboxes.
6. Restart `npm.cmd run dev` after changing environment values. Sign in at `/login`. Enroll an authenticator in Settings. Once a verified factor exists, database access requires an MFA-verified session. Owners can invite staff from Settings; their invitations also appear in local Mailpit.

Supabase Studio is normally at **http://127.0.0.1:54323**. Public signup is disabled. One account belongs to one shop in this initial version.

`npm.cmd run db:reset` **erases the local Supabase database** and reapplies migrations. Use `db:migrate` for normal development. Preview storage and Supabase are independent; preview records are never automatically imported into real customer data.

## How access works

The React app uses a public Supabase client key. Staff operations require a genuine Supabase Auth session. PostgreSQL checks active shop membership and MFA assurance through RLS; protected writes go through RPCs that validate inputs and run transactionally. Browser users cannot directly insert/update/delete tables, read tracking hashes, create owners, or call the tracking lookup RPC.

Customer tracking sends a reference and code in a POST body to `track-repair`. That function calls a server-only lookup and returns an explicit safe field list. Codes contain 96 random bits and only their SHA-256 hashes are stored. Code replacement invalidates the old code; collection sets a 30-day credential expiry. Results are cleared from the page after ten minutes. This initial version re-verifies the code on each refresh rather than issuing a separate customer session.

**Session design:** as a Vite SPA, this version uses the Supabase SDK with session storage, not an HttpOnly-cookie backend. Tokens remain accessible to JavaScript in the current tab. The server never trusts browser role claims; RLS enforces authorization. Inactivity signs the tab out after 30 minutes. A cookie-based backend-for-frontend would be a separate architecture change if required before production.

## Verification

```powershell
npm.cmd test
npm.cmd run check:functions
npm.cmd run build
# With Google Chrome installed (isolated test servers start automatically):
npm.cmd run test:browser
```

Database tests use **PGlite, a local PostgreSQL engine**, to execute the migration and check RLS, transactional changes, private response fields, tracking-code replacement, request limits, deactivation, MFA assurance, and collection. Tests stub the Supabase Auth schema and pgcrypto interface. They do not replace testing against actual Supabase Auth, pgcrypto, Mailpit, or the Deno Edge Runtime.

Browser checks cover desktop/mobile navigation, search/filtering, intake, persistence, status updates, schedule revision, invalid/valid customer tracking, information exposure, and collection. Connected-login contract tests use mock Supabase responses for login, refresh, protected routing, and logout. Tests start isolated servers with their own fake/empty environment values; they never use your actual project keys. Screenshots and failure traces go in ignored `qa/` and `test-results/` directories.

## Before using real customer data

This is a local first implementation, not a production security certification. The following remain release gates:

- Run actual local Supabase integration checks for owner setup, staff invitations, login/recovery/MFA, tracking, and Edge Function failures.
- Recheck Supabase project settings when moving online: local configuration does not automatically configure hosted Auth. Disable public signup, configure redirects, enable MFA, configure real SMTP, and set exact allowed origins.
- Validate the Edge gateway's trusted client-IP header before relying on per-source limits. Repair-target limits already use shared database counters. Review abuse limits and monitoring for the expected pilot traffic.
- Choose production hosting, HTTPS, encrypted backups, retention/deletion policies, a tested restore procedure, error monitoring with secret redaction, and an incident/recovery runbook.
- Apply the security headers in `public/_headers` using a host that supports that format, or configure equivalent headers at your chosen server. This file alone does not enable them on every host. Tighten the CSP connect allowlist to the exact production Supabase URL; configure HSTS on the HTTPS host.
- Complete accessibility/contrast checks and an independent security review. Owner MFA is available and enforced after enrollment; require enrollment operationally before the pilot. Lost-factor recovery currently requires a trusted Supabase administrator, not a self-service recovery-code system.
- Owner reopening/corrections, advanced exports, inventory, payments, automated billing, and status-notification delivery are not part of this implementation. Collected repairs are deliberately read-only.

## Main files

| Location | Responsibility |
| --- | --- |
| `src/pages/` | Dashboard, queue, repairs, customers, settings, login, tracking |
| `src/lib/api.ts` | Explicit preview adapter and Supabase calls |
| `src/lib/domain.ts` | Shared types and schedule/date rules |
| `supabase/migrations/` | Database, policies, and transactional repair operations |
| `supabase/functions/track-repair/` | Private customer lookup |
| `supabase/functions/invite-staff/` | Authorized staff invitations |
| `scripts/create-owner.mjs` | Privileged, interactive first-owner setup |
| `tests/` and `browser-tests/` | Database/business rules and end-to-end browser checks |
