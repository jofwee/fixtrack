# FixTrack website rebuild plan

Prepared for review on November 24, 2026. Implementation is in `fixtrack/`, using **Vite + React + Supabase and a green theme**. Your latest direction is **Vercel preview + Supabase Cloud**, superseding the supplied final brief's localhost/LAN-only setup. The cloud path does not require Docker. Deployment configuration, cloud setup scripts, defense-account provisioning, and live verification are prepared; applying them to the actual project awaits the remaining `.env.local` values and Vercel domain. See `fixtrack/CLOUD_SETUP.md` for the current setup path.

## 1. What this website is for

FixTrack is a repair management and tracking service for small electronics repair shops. Staff use it to record a customer's device, manage the repair, set expectations, and record collection. Customers use a separate page to check their own repair without calling the shop repeatedly.

Think of parcel tracking, applied to a phone or laptop left at a repair shop. The important difference is that repairs have uncertain completion dates, so the site must explain delays honestly.

The core journey is:

1. A customer leaves a device at a shop.
2. Staff create a repair job with the customer, device, problem, and estimated completion date.
3. The customer receives a repair reference and a private tracking code.
4. Staff update the job through **Received → Diagnosing → Repairing → Ready for Pickup → Claimed**.
5. The customer checks progress, the expected completion date, and any delay explanation.
6. Staff confirm collection and retain the record in repair history.

The intended business customer is the repair shop; the device owner is the tracking user. The supplied business paper proposes a subscription service for Philippine repair shops, initially around Las Piñas and Metro Manila. Its proposed prices and financial projections are business assumptions, not commitments for our rebuild.

The main value is **organized repair work and clear communication about when a device will be ready**. The site does not diagnose or repair devices itself.

## 2. What I reviewed and how the existing project works

Reviewed the project-owned source files, HTML entry point, package manifest, and dependency lockfile in `repairflow/`, together with both supplied Word documents. Installed third-party code in `node_modules/` is not project implementation.

| File | Current responsibility |
| --- | --- |
| `repairflow/package.json` | React 18, Vite 6, Lucide icons; development, build, and preview commands |
| `repairflow/index.html` | Loads the React application |
| `repairflow/src/main.jsx` | Demo repair data, login gate, screen navigation, dashboard, repairs, intake form, customers, history, settings, and turnaround editing |
| `repairflow/src/Login.jsx` | Login and password reset interfaces |
| `repairflow/src/authService.js` | Hardcoded demo account and a user object saved in browser local storage |
| `repairflow/src/styles.css` | Existing layout, colors, components, and responsive rules |

At startup, the app reads a user object from local storage. If one exists, it shows the staff interface. Otherwise, it shows login. Navigation switches React state rather than using real page routes. Repair records begin as five sample objects inside `main.jsx`; changes update component state only. Dashboard counts, customer cards, and history are calculated from that same array.

### Important gaps in the supplied version

| Area | What the code actually does | Rebuild requirement |
| --- | --- | --- |
| Authentication | Checks a password embedded in downloadable JavaScript; trusts an editable local-storage user object | Real authentication and server-validated sessions |
| Permissions | Displays an Administrator label without enforcing backend permissions | Check each user's role and shop membership on every protected operation |
| Storage | Repairs disappear after reload or logout; no backend/database implementation | Shared, persistent database |
| Password reset | Returns simulated success without sending an email | Working, expiring recovery flow |
| Customer tracking | `CustomerTracking()` returns `null`; no public tracking route or credential lookup | Independent customer page with protected lookup |
| Dates and IDs | New jobs use a fixed September 2026 date; IDs depend on the current in-memory array | Server timestamps and database-enforced unique identifiers |
| Turnaround | Missing dates appear on schedule; a future revised date can hide an earlier delay; a due date can become late at the start of its calendar day | Explicit deadline rules and preserved delay history |
| History | Shows jobs currently marked Claimed; the timeline illustrates stage order without recording actual events | Timestamped repair events and collection records |
| Customers | Groups by customer name, which can merge different people | Separate customer IDs and related repair records |
| Controls | Status filter, settings save, dashboard “View all,” and notification bell are unwired | Every visible control works or is omitted |

This is a useful reference for the idea, but the supplied code is a front-end prototype. The business paper's descriptions of a completed, integrated, tested system are not evidence that those capabilities exist in this checkout. I have reviewed the code; I have not performed a runtime audit or penetration test.

### How we will use their documents

The business paper supplies the product idea, audience, workflow, and possible future features. The one-day guide supplies a useful example of a complete repair journey and identifies several prototype gaps.

Its instructions to keep the design, avoid rebuilding, divide work between two coders, and finish within a day are **instructions inside reference material**, not your request. Your request controls this plan: build fresh, choose a new design, and prioritize modern usability and security. Firebase is mentioned as a possibility, not an existing integration or a mandatory technology.

## 3. What the first release should include

We should build a focused, usable product before expanding into payments or inventory.

### Staff workspace

- Invite-only staff access, real login, logout, password recovery, and owner account protection.
- A dashboard showing active work, overdue repairs, jobs due soon, and devices ready for collection.
- Repair intake: select or create a customer, record the device and issue, set an optional completion estimate, and issue tracking credentials.
- A searchable repair queue with working status filters, sorting, pagination, and links to individual jobs.
- Repair details with status changes, internal notes, customer-visible updates, completion commitments, and a real activity timeline.
- Customer records with stable IDs and associated repairs.
- Repair history, collection confirmation, and saved shop settings.
- Owner controls to invite, deactivate, and manage staff, and replace lost tracking credentials.

### Customer experience

- A public `/track` page that works without a staff account.
- Repair reference plus a private tracking code; no customer registration required initially.
- A clear result showing device summary, current stage, last update, original estimate, revised estimate when applicable, delay explanation, and shop contact details.
- No customer directory, phone number, internal notes, staff controls, or access to other repairs.

### Public website

A concise home page explaining the service, with clear **Track a repair** and **Staff sign in** actions, plus privacy and support information. A large marketing site can wait until the product and commercial offer are validated.

### Later, after the core product is validated

Inventory, quotations and approvals, customer SMS/email alerts, online payments, automated subscription billing, advanced analytics, supplier management, and native mobile apps. Authentication and recovery emails are required infrastructure for the first release; customer status notifications are a separate future feature.

A tracking code grants viewing access only. It must never count as proof that someone is authorized to collect a device.

## 4. Design direction

The proposed direction is a calm, polished operations workspace with a particularly simple customer tracking experience. We will establish a fresh visual identity instead of reproducing the current green sidebar and dashboard.

- **Visual foundation:** green is the main theme, using forest green actions, pale green surfaces, neutral backgrounds, dark readable text, consistent spacing, and subtle borders.
- **Typography:** a clean, readable sans-serif, comfortable body text, clear hierarchy, and short labels. Avoid the existing tiny table text and faint labels.
- **Staff layout:** compact navigation, a useful repair queue, a prominent intake action, and a repair detail screen organized around the next task.
- **Dashboard:** prioritize work needing attention. Every metric should link to the relevant filtered list; avoid decorative charts and repeated counts.
- **Customer layout:** a focused tracking form and a readable progress timeline. Explain what happens next and when the customer should contact the shop.
- **Mobile behavior:** comfortable touch targets, stacked forms, repair cards or an intentionally responsive table, and navigation that works on narrow screens.
- **Accessibility:** target WCAG 2.2 AA; support keyboard use, visible focus, labels, useful errors, sufficient contrast, reduced motion, and status indicators with words as well as color.
- **Complete interaction states:** design loading, empty, validation, network failure, expired session, invalid code, and successful save states alongside the main screens.

First design deliverable: representative desktop and mobile layouts for the repair queue, repair detail, intake, and customer tracking. These establish the direction before we build every screen.

## 5. Proposed technical architecture

**Selected stack after discussion:** Vite, React, TypeScript, React Router, CSS, Supabase Auth, PostgreSQL, and Supabase Edge Functions. Supabase replaces the earlier proposed Prisma/Better Auth setup. Local Supabase requires Docker Desktop on Windows; a separately labeled sample-data adapter allows design/workflow review before Docker is installed.

React provides the interface, TypeScript helps catch data mistakes, and PostgreSQL suits related customers/jobs/staff/events. Supabase manages authentication and exposes authenticated database operations. Row Level Security checks shop membership, while transactional database functions enforce protected changes. Edge Functions handle customer tracking and staff invitations using server-only privileged credentials.

```text
Staff React app                 Customer React page
       |                                |
  Supabase Auth                  Tracking Edge Function
       |                                |
  Authenticated API/RPC          Restricted server-only lookup
       |                                |
       +-------- PostgreSQL ------------+
              RLS and workflow rules
```

Staff queries use Supabase's public client key plus a real authenticated session; server-side RLS is the security boundary. Staff writes use protected transactional RPCs rather than direct table updates. Public tracking uses its own narrow server response and cannot query staff tables or tracking hashes. Private fields are never sent to the customer page. No database passwords or privileged keys go into browser code.

Use managed PostgreSQL with backups and a managed application host. Choose providers after comparing deployment region, recovery features, email delivery, rate-limit support, and recurring cost. This plan does not assume free tiers are sufficient or repeat the supplied paper's infrastructure budget as a verified estimate.

Build in a new sibling directory, provisionally `fixtrack/`, while preserving `repairflow/` as a reference. Start with fictitious seed records; do not import the prototype's session data or assume its sample names represent real customers.

## 6. Data and repair workflow rules

### Main records

| Record | Purpose |
| --- | --- |
| Shop | Business identity, timezone, and configuration |
| User and session | Individual staff identities and revocable sessions, managed through the auth library |
| Shop membership | Which shop a user belongs to and their role |
| Customer | Stable customer ID, necessary contact information, and shop ownership |
| Repair | Device, issue, customer link, stage, dates, shop ownership, and concurrency version |
| Repair event | Actual status changes, estimate revisions, delay reports, and authorized corrections with actor and timestamp |
| Repair note | Explicitly internal or customer-visible content |
| Tracking credential | Hashed private code, repair link, expiry, and revocation state |

Each business record belongs to a shop. Membership checks and shop-scoped queries prevent one shop from seeing another's records. Pilot with one shop, but test with two shops from the beginning. This prepares for the business paper's subscription concept without building billing now.

Use database-generated internal IDs and a separate human-readable repair reference. Enforce uniqueness in the database, including simultaneous intake requests. Scope related records with database constraints so a repair cannot accidentally link to another shop's customer. Create the repair, initial event, and tracking credential atomically.

### Status and collection

- Normal movement follows the five original stages. Enforce allowed transitions on the server.
- Changing a stage records the actor and actual timestamp; a visual timeline must not invent completion events for skipped stages.
- Owner corrections or reopening require a reason and retain the earlier events. Claimed jobs are otherwise read-only.
- Record `ready_at` separately from `claimed_at`. A repaired device waiting for pickup is not an unfinished repair.
- Record staff confirmation of collection using the shop's agreed verification procedure. Never ask customers to store device unlock passwords in this system.
- Use a version check so two staff members cannot silently overwrite each other's updates. Prevent duplicate intake submissions.

### Completion promises and delays

Keep **repair stage**, **current schedule condition**, and **past delays** as separate concepts.

| Condition | Display and rule |
| --- | --- |
| No completion estimate | “Not set”; do not imply the job is on schedule |
| Unfinished, within the current commitment | “On schedule,” while still showing any previous revisions |
| Current commitment has passed | Automatically show “Overdue”; staff cannot hide this by failing to record a delay |
| Staff records a delay | Require a customer-safe reason and revised completion date; retain the previous promise |
| Ready for Pickup | Show when the device became ready and preserve whether the repair was late; do not keep counting repair lateness while awaiting collection |
| Claimed | Show collection date and retained repair/commitment history |

Preserve the first promised completion date once set. Store every revision as an event rather than overwriting the history. A future revised date can mean the repair is within its revised schedule, but the original delay must remain visible. If a revised promise is missed, show overdue again and request another update.

Store event timestamps in UTC and display them in the shop's timezone, initially `Asia/Manila`. Store day-based promises as calendar dates; a promise for today lasts through the end of that shop day. Distinguish unknown dates from valid dates. Define these rules once and use them for both staff and customer views.

## 7. Security requirements built into the first release

“As secure as possible” needs concrete controls, verification, and maintenance. We should target the applicable OWASP ASVS Level 2 requirements, document exceptions, and arrange an independent security review before wider use with real customers. This is a target, not a claim of certification. [OWASP ASVS](https://asvs.owasp.org/)

### Identity and permissions

- Individual accounts; no shared admin login, embedded passwords, or browser-stored role claims trusted by the server.
- The selected Vite SPA uses Supabase Auth sessions in session storage, with automatic token refresh and a 30-minute inactivity sign-out. These tokens are JavaScript-accessible; this is a deliberate difference from the earlier cookie-based backend proposal. Authorization still happens in PostgreSQL. A backend-for-frontend with HttpOnly cookies would be a separate hardening change before production if required. Review session revocation and recovery against actual Supabase before launch. [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- Invite-only staff onboarding. Require owner MFA before the pilot; the implementation includes TOTP enrollment and challenge, with elevated assurance enforced in database access after enrollment. A tested administrator-assisted lost-factor recovery procedure remains a release gate; self-service recovery codes are not implemented.
- Use the authentication library's supported password hashing, recovery, and CSRF/origin protections; verify configuration rather than writing custom cryptography. Rate-limit login, recovery, and tracking attempts.
- Re-check identity, active membership, shop, role, and target record on every server read/write. Page redirects and hidden buttons are not permission enforcement. [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

| Capability | Owner/admin | Staff/repairer | Customer tracker |
| --- | --- | --- | --- |
| View shop repair/customer records | Yes, own shop | Yes, own shop | Only the safe view of one authorized repair |
| Create and update active repairs | Yes | Yes | No |
| Add internal notes | Yes | Yes | No |
| Confirm collection | Yes | Yes, under the collection procedure | No |
| Manage staff/settings | Yes | No | No |
| Reopen/correct completed work | Yes, with reason | No | No |
| View audit history | Yes | Repair activity needed for work | Customer-visible progress only |

Default to denied access when a rule is missing; enforce permissions even when someone calls the API directly. [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

### Private customer tracking

- Generate a cryptographically random private code. The initial implementation uses 24 hexadecimal characters (96 random bits), grouped for readability. Keep the reference-plus-code experience from the documents, with stronger credentials than a short numeric PIN.
- Store a one-way hash of the code. Show the code at issuance; if it is lost, authorized staff revoke and replace it. Do not offer plaintext retrieval from storage.
- Send credentials in a POST body, never in URLs, analytics, logs, or browser local storage. Configure monitoring to redact request bodies and secrets.
- Validate on the server, apply shared rate limits across application instances, and return a generic “No matching repair found” for invalid credentials. Combine source and repair-target limits with progressive delays so distributed guessing is restricted without allowing easy permanent lockouts.
- The initial implementation re-verifies the private code on each customer refresh and clears the result after ten minutes. It does not create a staff session. A separate repair-scoped viewing session can be added later if needed.
- Return an explicit safe field list. Exclude customer identity/contact details, internal notes, staff information, and unnecessary device identifiers. Use a deliberately customer-safe issue summary.
- Mark tracking and staff responses private and non-cacheable; prevent indexing and avoid third-party analytics on sensitive screens. Set a short tracking-session timeout and expire credentials after the agreed collection grace period.

### Application, database, and operations

- Validate inputs on the server, including lengths, accepted statuses, date rules, and editable fields. Use parameterized database operations and safe text rendering.
- Apply a restrictive Content Security Policy, frame restrictions, HTTPS/HSTS, and appropriate referrer/security headers. Verify CSRF defenses for all cookie-authenticated mutations; GET requests must not change data.
- Give the application database account only necessary privileges. Keep migration/admin credentials separate; store secrets in deployment secret storage and scan the repository/build output for accidental exposure.
- Record important changes in an audit trail that ordinary application roles cannot edit or delete. Restrict access and keep private notes, passwords, codes, and unnecessary personal data out of logs.
- Minimize collected personal data; document who may access it, the retention period, deletion/anonymization process, and how backup expiry handles deleted data. Finalize these policies before real customer use.
- Use encrypted connections and provider encryption at rest, automated backups, an actual restore test, monitoring, and a short incident-response procedure.
- Maintain separate development, staging, and production environments. Review dependency advisories, pin reviewed dependencies in a lockfile, and establish a patch routine.
- Keep uploads outside the initial scope. If device photos are added later, design private storage and file validation before enabling uploads.

Before the pilot, agree recovery objectives. A provisional target is no more than 24 hours of data loss and restoration within one business day; confirm whether that is acceptable and fund stronger recovery if needed.

## 8. Build sequence and review checkpoints

These are completion-based milestones, not a promise to deliver production security in one day. Calendar estimates follow the scope/design review and infrastructure choices.

### Phase 1 — Confirm the product and design

Finalize the first-release journeys, permissions, tracking fields, deadline rules, and visual direction. Produce representative responsive layouts and a small component/style specification.

**Complete when:** you can review the proposed experience and follow intake through customer tracking without needing to infer missing screens.

### Phase 2 — Establish the secure foundation

Create the fresh project, schema/migrations, server-only data layer, authentication, invitations, MFA, shop membership enforcement, and staging configuration. Create fake records for two shops to test isolation.

**Complete when:** real sessions work and direct requests from the wrong shop or role fail before any repair data is exposed.

### Phase 3 — Build one complete repair journey

Implement intake, durable storage, credential issuance, repair details, status events, estimates/delays, private tracking, and collection/history. Start with this vertical slice before expanding dashboard screens.

**Complete when:** staff can create a job, refresh, update it, and see the same authorized customer view from a separate browser/device through to collection.

### Phase 4 — Complete the workspace and polish

Add the useful dashboard, queue filters/search, customer records, settings, staff management, public home page, responsive layouts, and all error/empty/loading states. Check keyboard and mobile usability.

**Complete when:** all visible controls work, representative screens are reviewed on desktop/mobile, and a staff member can perform routine work without developer assistance.

### Phase 5 — Verify and prepare a limited pilot

Run the acceptance checks below, review applicable ASVS requirements, test backups/recovery, check secrets and dependencies, and document deployment/rollback and operational procedures. Use a small pilot to gather real usability feedback before commercial expansion.

**Complete when:** critical issues are resolved, residual risks are documented, and the full workflow works in staging. Production deployment and service purchases remain separate steps after review.

## 9. Acceptance checks

Use focused automated tests for important business/security rules, integration tests against a real test database, and browser tests for the complete journey. Visual review is also required; a passing build does not establish usability or security.

- [ ] New jobs and changes survive reloads and appear correctly in a separate authorized browser session.
- [ ] Simultaneous creates cannot generate duplicate references; repeated submission does not create duplicate jobs.
- [ ] Concurrent edits produce a clear conflict instead of silently losing an update.
- [ ] Normal stages, authorized corrections, readiness, collection, and history follow the agreed rules and record real timestamps.
- [ ] Missing dates, today/end-of-day boundaries, overdue jobs, revised promises, and repeated delays display correctly in Manila time.
- [ ] Original promises and earlier delays remain visible after rescheduling or completion.
- [ ] Customer tracking works without staff login and exposes only one repair's approved fields, including in raw network responses.
- [ ] Wrong references/codes, expired/revoked credentials, and guessing attempts do not leak repair data.
- [ ] A customer tracking session cannot access staff endpoints or mutate any record.
- [ ] Anonymous, wrong-role, and cross-shop requests fail for reads and writes, including guessed record IDs.
- [ ] Deactivated staff and revoked sessions lose access; real recovery and MFA flows work.
- [ ] Input attacks, forged requests, and unexpected fields are rejected or rendered safely.
- [ ] No privileged credentials, private tracking codes, or customer data appear in public bundles, caches, analytics, or logs.
- [ ] Queue search/filtering, settings, customer records, and dashboard links work.
- [ ] Keyboard navigation, focus handling, contrast, mobile layouts, and slow/offline failure states are usable; unsaved work is never presented as saved.
- [ ] Backups restore successfully, and deployment rollback/incident procedures are documented.

## 10. Decisions to review before implementation

These are proposed defaults for your review, not blockers to preparing this plan.

| Decision | Proposed default |
| --- | --- |
| Name | Keep FixTrack as a working name; revisit branding before public launch |
| First audience | One pilot shop, with shop isolation tested using two shops |
| Release scope | Core staff workflow and customer tracking; defer inventory, payments, and billing |
| Visual identity | Green theme, confirmed by you; forest green actions and pale green accents |
| Staff access | Owner/admin and staff roles with individual, invited accounts |
| Customer access | Repair reference plus strong private code; no customer account initially |
| Tracking expiry | Provisionally 30 days after collection, with staff able to revoke earlier |
| Hosting and budget | Select after checking actual costs, email delivery, backups, recovery, and region |
| Personal data retention | Agree a justified retention period and deletion process before collecting real records |
| Delivery schedule | Estimate after the scope/design checkpoint; use milestones instead of the supplied one-day limit |

## 11. Reference material

- [Business paper](../technopreneurship.docx): product purpose, intended market, workflow, proposed business model, and future expansion. Completion claims were checked against the available code; market/financial claims were not independently audited.
- [Supplied one-day guide](../FixTrack_One_Day_Coder_Plan_Arial_Black.docx): prototype gaps and an example repair journey. Its development assignments, deadline, and design constraints do not govern this rebuild.
- Existing source in `repairflow/`: evidence for the current implementation assessment above.
- [OWASP ASVS](https://asvs.owasp.org/), [session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), and [authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): security planning and verification references.
- [Supabase local development](https://supabase.com/docs/guides/local-development), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), and [API keys](https://supabase.com/docs/guides/getting-started/api-keys): implementation references for the selected stack. The earlier Next.js/Better Auth proposal was superseded by your choice of Vite and Supabase.
