# Supabase Cloud and Vercel preview

This is the setup path for the defense. The frontend runs on Vercel; accounts, records, access rules, and Edge Functions run on Supabase Cloud. Docker and school LAN sharing are not required for this path. The existing green interface is retained.

## Fill the local environment file

An ignored `fixtrack/.env.local` template has been created. The project URL is already filled in locally. Add the remaining values there, never in source code or a public commit.

| Variable | Where it comes from | Goes in Vercel? |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → publishable key; a legacy anon key also works | Yes |
| `SUPABASE_SECRET_KEY` | Project Settings → API Keys → server-only secret key | No |
| `SUPABASE_ACCESS_TOKEN` | Supabase account → Access Tokens; scope it to this project and the setup operations | No |
| `SUPABASE_DB_PASSWORD` | The database password chosen when the Supabase project was created | No |
| `APP_URL` | Your chosen stable Vercel URL, e.g. `https://your-project.vercel.app` | No; used by the setup script and Supabase functions |
| `ALLOWED_ORIGINS` | Optional extra exact origins, separated by commas | No; applied to Supabase functions |

`SUPABASE_SERVICE_ROLE_KEY` is supported as a legacy alternative to `SUPABASE_SECRET_KEY`; only one is needed. This is different from the personal access token and the database password.

The personal access token needs the project permissions used by CLI linking, Auth configuration, Edge Function deployment, and project secrets. In Supabase's current scoped token UI, CLI linking requires read access to Project Settings, API Keys, and API Key Secrets. Restrict access to this project rather than the whole account. It can be revoked after setup; it is not needed to run the website.

Do not use `VITE_` names for private values. The build checks for privileged values in public configuration and refuses to bundle them. Never add private keys or database passwords to Vercel for this static frontend.

## Configure Vercel

Import the GitHub repository and set:

- **Root Directory:** `fixtrack`
- **Framework:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Node:** 24.x, or a supported release compatible with the project
- **Environment variables:** only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, for the environments you deploy to

The included `vercel.json` handles refresh/deep links and security headers. The Vite build embeds its public environment values, so redeploy after changing them. A deployment without complete Supabase settings shows a setup screen, not a sample admin workspace.

Choose a stable Vercel domain for the defense and put it in local `APP_URL`. Panelists must be able to open that domain without a Vercel account. Unique per-commit preview domains need to be explicitly added to `ALLOWED_ORIGINS` and reconfigured; wildcard origins are not accepted.

## Apply the cloud backend

Run from `fixtrack/`:

```powershell
npm.cmd run setup:cloud -- --check
npm.cmd run setup:cloud
```

The check only validates required fields. The setup command makes real changes to the named Supabase project:

1. Links the local project and checks pending migrations.
2. Applies the tracked schema and access policies with `db push`; it does not reset the database.
3. Sets the website URL, exact password/invitation redirects, minimum password length, MFA availability, and disabled public signup.
4. Sets `APP_URL` and `ALLOWED_ORIGINS` in Supabase's function environment.
5. Deploys `track-repair` and `invite-staff` using API-based deployment, without Docker.
6. Reads back the selected Auth settings without printing secrets.

Supabase injects its own server/API keys into deployed Edge Functions. The functions support current named key dictionaries and legacy keys. Do not manually create `SUPABASE_` function secrets; that prefix is reserved by the platform.

No cloud changes have been applied until this command succeeds with your actual setup values.

## Create defense accounts

```powershell
npm.cmd run setup:defense
```

This creates a real Supabase owner, a staff member, and a dedicated demo shop. Strong random passwords are written to ignored `defense-accounts.local.txt`; they are not printed, committed, or hardcoded in the app. The script refuses to overwrite existing users or an existing credential file.

Defaults are `admin@fixtrack.test` and `staff@fixtrack.test`. These are demonstration identities that cannot receive email. To use real test inboxes, set `DEFENSE_ADMIN_EMAIL` and `DEFENSE_STAFF_EMAIL` locally before running setup. Direct test-account creation does not depend on SMTP. Invitation/recovery delivery to arbitrary real inboxes may require configuring Supabase SMTP separately.

For normal owner onboarding through email instead, run `npm.cmd run setup:owner`. Its invitation now redirects to `APP_URL`.

## Verify the live backend

```powershell
npm.cmd run check:cloud
```

This uses the generated defense accounts to test real admin/staff login, two independent sessions, record persistence, duplicate intake protection, safe/invalid tracking lookup, dates, delay revisions, collection, and history. It leaves two fictional repair jobs: one completed and one active for panelists to try. Their details and a record snapshot are saved in ignored `defense-check.local.txt`.

The generated accounts do not start with MFA enrolled. If you enroll MFA, use the browser's authenticator challenge; the password-only smoke script intentionally cannot bypass an enrolled factor.

Then verify the actual devices:

1. Sign in as staff on one laptop and create a fictional repair. Keep its reference and private code.
2. Open `/track` on another laptop or phone, enter those details, and confirm that only the safe repair information is shown.
3. Change stages and completion estimates on the staff device. Refresh the customer page and verify the saved changes.
4. Test an incorrect code, then finish Ready for Pickup → Claimed and confirm the record remains in Repair History.
5. Sign out and open `/app` directly; it must return to sign-in. Try the same workflow on a cellphone.

Git holds the source backup. Keep the ignored credential and verification files privately for the defense; do not put them in the public repository. A database backup/restore policy for real customer operations is a separate production task.

## Verification boundaries

Local database tests execute the SQL on PostgreSQL through PGlite with simulated Auth tables and crypto interfaces. Browser API contract tests verify the connected-login interface using mock responses. Neither replaces the live Supabase check above or physical multi-device testing. If keys or the deployed domain are missing, those live checks remain pending.

Reference: [Supabase CLI](https://supabase.com/docs/reference/cli/introduction), [Edge deployment](https://supabase.com/docs/guides/functions/quickstart), [function environment](https://supabase.com/docs/guides/functions/secrets), [Auth configuration API](https://supabase.com/docs/reference/api/v1-update-auth-service-config), [personal access tokens](https://supabase.com/docs/guides/platform/personal-access-tokens), and [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).
