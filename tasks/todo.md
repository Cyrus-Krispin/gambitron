# Production Readiness Tasks

## Task 1: Correct engine search invariants

**Acceptance criteria:**
- [x] Quiescence never uses stand-pat while the side to move is in check.
- [x] History-table keys are recorded for the same side used during lookup.
- [x] Regression tests fail on the old logic and pass on the corrected logic.

**Verification:** focused Vitest tests; `npm run test:engine`; `npm run build`.

**Dependencies:** None.
**Files likely touched:** `frontend/src/lib/wasmEngine.ts`, focused test file.
**Estimated scope:** Small.

## Task 2: Preserve move and result fidelity

**Acceptance criteria:**
- [x] All four promotion choices round-trip through saved replay history.
- [x] Checkmate, stalemate, repetition, insufficient material, and move-rule draws have accurate termination labels.
- [x] Invalid replay data produces a recoverable error, not a render crash.

**Verification:** focused Vitest tests; local-game smoke; build.

**Dependencies:** Task 1.
**Files likely touched:** `frontend/src/hooks/useGame.ts`, `frontend/src/lib/localHistory.ts`, `frontend/src/pages/Replay.tsx`, tests.
**Estimated scope:** Medium.

## Task 3: Recover active games after reload

**Acceptance criteria:**
- [x] Active position, clocks, move history, and timestamps survive reload.
- [x] Elapsed clock time is reconciled safely on recovery.
- [x] Missing/expired game IDs show a clear recovery action instead of a dead board.

**Verification:** focused runtime test; browser reload/direct-route smoke; build.

**Dependencies:** Task 2.
**Files likely touched:** `frontend/src/lib/localGameSocket.ts`, `frontend/src/hooks/useGame.ts`, `frontend/src/pages/Play.tsx`, test script.
**Estimated scope:** Medium.

## Task 4: Fix responsive game layout

**Acceptance criteria:**
- [x] Full board, clocks, and controls are visible at 320px.
- [x] Navigation remains available at all supported widths.
- [x] Desktop layout remains visually stable.

**Verification:** screenshots and a played move at 320px, 768px, 1024px, and 1440px.

**Dependencies:** Task 3.
**Files likely touched:** `frontend/src/index.css`, `frontend/src/components/Layout.tsx`.
**Estimated scope:** Small.

## Task 5: Complete keyboard and screen-reader flows

**Acceptance criteria:**
- [x] Board supports roving focus and keyboard move selection.
- [x] Promotion and replay controls are keyboard-complete with correct dialog/current-state semantics.
- [x] Turn, result, and actionable error changes are announced without noisy clock updates.

**Verification:** keyboard browser walkthrough; accessibility tree/axe check; component tests.

**Dependencies:** Task 4.
**Files likely touched:** `frontend/src/components/ChessBoard.tsx`, `frontend/src/components/Dialogs.tsx`, `frontend/src/pages/Play.tsx`, `frontend/src/pages/Replay.tsx`, tests.
**Estimated scope:** Medium.

## Task 6: Add resilient application shell

**Acceptance criteria:**
- [x] Unexpected render failures show a retry/home fallback and emit sanitized telemetry.
- [x] Unknown routes render a real not-found page.
- [x] Route patterns do not shadow one another.

**Verification:** component/routing tests; browser console check; build.

**Dependencies:** None.
**Files likely touched:** `frontend/src/App.tsx`, error-boundary component/test, not-found page.
**Estimated scope:** Medium.

## Task 7: Make dependencies and toolchain reproducible

**Acceptance criteria:**
- [x] No unmitigated reachable high/critical audit findings.
- [x] Build-only packages are dev dependencies and vulnerable packages are patched.
- [x] Node and npm versions are declared consistently with CI/Vercel.

**Verification:** clean `npm ci`; registry signature check; audits; lint; tests; build; lockfile review.

**Dependencies:** Mermaid removal decision.
**Files likely touched:** `frontend/package.json`, `frontend/package-lock.json`, toolchain version file.
**Estimated scope:** Medium.

## Task 8: Harden deployment configuration

**Acceptance criteria:**
- [x] HTML/routes have CSP, frame, MIME, referrer, and permissions headers.
- [x] Hashed assets use immutable caching.
- [x] Metadata, environment setup, rollback, and post-deploy smoke checks are documented.

**Verification:** local Vercel config validation; response-header checks; build artifact inspection.

**Dependencies:** Task 7.
**Files likely touched:** `frontend/vercel.json`, `frontend/index.html`, `.gitignore`, `.env.example`, README/runbook.
**Estimated scope:** Medium.

## Task 9: Enforce release gates in CI

**Acceptance criteria:**
- [x] Lint warnings fail CI.
- [x] Unit, browser, and dependency audit gates run in CI.
- [x] Workflow uses least-privilege permissions and the supported toolchain.

**Verification:** action syntax validation and equivalent local commands.

**Dependencies:** Tasks 1-8.
**Files likely touched:** `.github/workflows/frontend.yml`, package scripts.
**Estimated scope:** Small.

## Task 10: Secure persistence boundary

**Acceptance criteria:**
- [x] The selected product model is explicit: local-only history.
- [x] The anonymous remote path is disabled and the legacy schema is marked non-deployable.
- [x] Browser-local records remain the source of truth.

**Verification:** persistence contract tests; schema-policy tests if remote is retained; documented production configuration.

**Dependencies:** User product decision.
**Files likely touched:** persistence module, Supabase migration/schema, README, tests.
**Estimated scope:** Medium.
