# FixTrack

A green repair-management website for electronics repair shops, built with **Vite, React, TypeScript, and Supabase**.

Staff can check in devices, manage repair stages, record estimates and delays, and confirm collection. Customers get a separate private tracking page.

## Run the sample workspace

Install Node.js 22.12+ or a compatible newer release, then run:

```bash
cd fixtrack
npm install
npm run dev
```

Open **http://127.0.0.1:5173**.

Without Supabase configured, the app uses clearly labeled fictional data saved in your browser. Each browser has its own records. Do not use preview mode for real customer information.

## Enable accounts and shared records

The Supabase schema, access policies, and Edge Functions are included. Local Supabase requires Docker Desktop. See the [full setup guide](fixtrack/README.md) for database setup, owner provisioning, invitations, MFA, and verification limits.

Never commit `.env.local`, privileged keys, or real customer data.

## Checks

```bash
cd fixtrack
npm test
npm run check:functions
npm run build
# With the Vite server running and Chrome installed:
npm run test:browser
```

See [the project plan](plan.md) for scope and architecture. This is an initial local build; actual Supabase integration testing and the production release checks in the setup guide remain necessary.
