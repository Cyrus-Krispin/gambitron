# Gambitron Production Runbook

## Ownership and release gate

The repository owner is the release owner until an on-call rotation is assigned. Production promotion requires a reviewed pull request, a green `Frontend WASM CI / verify` check, and a verified Vercel preview deployment for the exact commit. Never enable the legacy Supabase schema or `VITE_SUPABASE_*` variables.

Required GitHub repository settings:

- Protect `main`; require pull requests, conversation resolution, and `Frontend WASM CI / verify`.
- Block force pushes and direct pushes, including administrator bypass for ordinary releases.
- Enable secret scanning and push protection.

## Preview verification

1. Confirm the preview commit matches the pull-request head SHA.
2. Run the browser critical-flow probe against the preview:

   ```bash
   cd frontend
   VERCEL_AUTOMATION_BYPASS_SECRET=... \
     PLAYWRIGHT_BASE_URL=https://preview.example \
     npm run test:e2e
   ```

   The bypass value must be a scoped Vercel Deployment Protection automation secret stored in the release environment; never commit it or expose it as a Vite variable.

3. Verify `/health.json` contains `{"status":"ok","application":"gambitron"}`.
4. Verify the HTML response has CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and frame-denial headers.
5. Test one game manually at 320px: play a move, wait for the reply, reload the active URL, and confirm the position and clocks recover.
6. Confirm a deliberately triggered preview exception emits a sanitized `client_error` event without a message, stack, game ID, or user data.

## Promotion and first-hour monitoring

Promote only the verified immutable preview deployment. Record the deployment URL and previous known-good URL in the release notes. For the first hour, the release owner watches Vercel deployment/runtime errors, Web Analytics `client_error` events, and the browser critical-flow probe.

Rollback immediately when any of these occur:

- The critical-flow probe fails twice consecutively.
- The app cannot start or recover a game, or a route serves a blank page.
- `client_error` reaches five events in five minutes after excluding a known test event.
- A new CSP violation blocks the application bundle, pieces, fonts, or analytics.
- A high/critical reachable dependency advisory or exposed secret is discovered.

## Rollback

1. Stop further promotions and announce the rollback in the release channel.
2. Roll back to the recorded known-good deployment in the Vercel dashboard, or run:

   ```bash
   vercel rollback <known-good-deployment-url>
   ```

3. Re-run the health, header, and browser critical-flow checks against production.
4. Confirm the error signal returns below the trigger threshold for 15 minutes.
5. Open an incident issue with the bad and restored deployment URLs, commit SHAs, impact window, evidence, and follow-up owner.

Browser-local game history does not require a database restore. If authenticated remote persistence is introduced later, this runbook must gain backup/PITR verification and database rollback steps before that feature ships.
