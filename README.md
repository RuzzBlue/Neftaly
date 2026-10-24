# Neftaly — Gestión de Tropa Scout

Static app built with Vite, hosted on GitHub Pages, using Neon Postgres, Managed Better Auth, and the Neon Data API.

## Local setup

Requires Node.js 24. Install dependencies with `npm ci`.

Link the existing Neon project (do not create another project):

`npx neon@latest link --org-id org-bitter-base-37060231 --project-id mute-fire-36946923 --branch production -y`

The CLI writes ignored `.neon` and `.env.local` files. Keep DATABASE_URL and DATABASE_URL_UNPOOLED private. The browser build receives only the public Auth/database HTTPS endpoints, never database credentials.

Run `npm run dev` and open the printed /Neftaly/ URL. Register the exact local origin with `npx neon@latest neon-auth domain add http://127.0.0.1:5173` if needed.

## Schema and accounts

`neon/001_schema.sql` defines the fresh Neon schema, profile trigger, roles, RLS, and reset function. Test changes on a Neon branch first. Apply with `npm run migrate`, then `npx neon@latest data-api refresh-schema --database neftalydb`.

Every person registers their own email, name, and password, then enters the email verification code. Email/password Auth must require verification with OTP enabled. New accounts have the pending role and cannot read troop data. Super Admin approves accounts in **Editar cuenta → Usuarios**. Leaders keep the existing troop permissions; only Super Admin can assign roles or reset the troop. The final Super Admin cannot demote themselves.

The first administrator is reserved in `neftaly_private.bootstrap_admin`, outside the exposed API schema. Insert the owner's email with a parameterized administrative SQL query before registration. Only a verified email can consume that reservation. Do not assign the first person who signs up as admin.

For additional administrators, use the existing Super Admin UI. Change your password in **Mi cuenta** using your current password. Account email changes are intentionally read-only; authentication identity and profile email must stay consistent.

The files under `supabase/`, the old `js/config*.js`, and old create-users scripts are historical and are no longer used by the app. No existing Supabase records are migrated or deleted.

## Build and deployment

`npm run build` writes `dist/`. `npm run preview` serves the compiled app.

The GitHub Pages workflow installs locked dependencies, builds with the public production Auth URL, and uploads **only dist/**. It never uploads the repository root or local environment files. Merging into main publishes at https://ruzzblue.github.io/Neftaly/.

## Verification

Create the disposable Neon branch `migration-test` with `npx neon@latest checkout migration-test --create`, apply the schema, and refresh its Data API schema. Then run:

`node --env-file=.env.local scripts/verify-neon.mjs`

This suite refuses production. It creates disposable example.com test accounts, uses known OTP hash fixtures to exercise email verification for those test users, and verifies authentication, session restoration, sign-out, anonymous/pending restrictions, blocked self-promotion, admin approval, patrol/member CRUD, points, attendance, and reset permissions. It saves test-only credentials in the ignored `.test-credentials.local.json` for browser checks. No real person's email-code delivery is asserted by this automated suite.

Return to production using `npx neon@latest checkout production` after testing. Neon branches and their Auth/Data API endpoints are isolated; never deploy a test branch's endpoint to the production frontend.
