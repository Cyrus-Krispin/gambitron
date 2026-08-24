# Production Readiness Tasks

## Task 1: Correct engine search invariants

**Acceptance criteria:**
- [ ] Quiescence never uses stand-pat while the side to move is in check.
- [ ] History-table keys are recorded for the same side used during lookup.
- [ ] Regression tests fail on the old logic and pass on the corrected logic.

**Verification:** focused Vitest tests; `npm run test:engine`; `npm run build`.

**Dependencies:** None.
**Files likely touched:** `frontend/src/lib/wasmEngine.ts`, focused test file.
**Estimated scope:** Small.

## Task 2: Preserve move and result fidelity

**Acceptance criteria:**
- [ ] All four promotion choices round-trip through saved replay history.
- [ ] Checkmate, stalemate, repetition, insufficient material, and move-rule draws have accurate termination labels.
- [ ] Invalid replay data produces a recoverable error, not a render crash.

**Verification:** focused Vitest tests; local-game smoke; build.

**Dependencies:** Task 1.
**Files likely touched:** `frontend/src/hooks/useGame.ts`, `frontend/src/lib/localHistory.ts`, `frontend/src/pages/Replay.tsx`, tests.
**Estimated scope:** Medium.

## Task 3: Recover active games after reload

**Acceptance criteria:**
- [ ] Active position, clocks, move history, and timestamps survive reload.
- [ ] Elapsed clock time is reconciled safely on recovery.
- [ ] Missing/expired game IDs show a clear recovery action instead of a dead board.

**Verification:** focused runtime test; browser reload/direct-route smoke; build.

**Dependencies:** Task 2.
**Files likely touched:** `frontend/src/lib/localGameSocket.ts`, `frontend/src/hooks/useGame.ts`, `frontend/src/pages/Play.tsx`, test script.
**Estimated scope:** Medium.

## Task 4: Fix responsive game layout

**Acceptance criteria:**
- [ ] Full board, clocks, and controls are visible at 320px.
- [ ] Navigation remains available at all supported widths.
- [ ] Desktop layout remains visually stable.

**Verification:** screenshots and a played move at 320px, 768px, 1024px, and 1440px.

**Dependencies:** Task 3.
**Files likely touched:** `frontend/src/index.css`, `frontend/src/components/Layout.tsx`.
**Estimated scope:** Small.

## Task 5: Complete keyboard and screen-reader flows

**Acceptance criteria:**
- [ ] Board supports roving focus and keyboard move selection.
- [ ] Promotion and replay controls are keyboard-complete with correct dialog/current-state semantics.
- [ ] Turn, result, and actionable error changes are announced without noisy clock updates.

**Verification:** keyboard browser walkthrough; accessibility tree/axe check; component tests.

**Dependencies:** Task 4.
**Files likely touched:** `frontend/src/components/ChessBoard.tsx`, `frontend/src/components/Dialogs.tsx`, `frontend/src/pages/Play.tsx`, `frontend/src/pages/Replay.tsx`, tests.
**Estimated scope:** Medium.

## Task 6: Add resilient application shell

**Acceptance criteria:**
- [ ] Unexpected render failures show a retry/home fallback and emit sanitized telemetry.
- [ ] Unknown routes render a real not-found page.
- [ ] Route patterns do not shadow one another.

**Verification:** component/routing tests; browser console check; build.

**Dependencies:** None.
**Files likely touched:** `frontend/src/App.tsx`, error-boundary component/test, not-found page.
**Estimated scope:** Medium.

## Task 7: Make dependencies and toolchain reproducible

**Acceptance criteria:**
- [ ] No unmitigated reachable high/critical audit findings.
- [ ] Build-only packages are dev dependencies and unused vulnerable packages are removed or patched.
- [ ] Node and npm versions are declared consistently with CI/Vercel.

**Verification:** clean `npm ci`; registry signature check; audits; lint; tests; build; lockfile review.

**Dependencies:** Mermaid removal decision.
**Files likely touched:** `frontend/package.json`, `frontend/package-lock.json`, toolchain version file.
**Estimated scope:** Medium.

## Task 8: Harden deployment configuration

**Acceptance criteria:**
- [ ] HTML/routes have CSP, frame, MIME, referrer, and permissions headers.
- [ ] Hashed assets use immutable caching.
- [ ] Metadata, environment setup, rollback, and post-deploy smoke checks are documented.

**Verification:** local Vercel config validation; response-header checks; build artifact inspection.

**Dependencies:** Task 7.
**Files likely touched:** `frontend/vercel.json`, `frontend/index.html`, `.gitignore`, `.env.example`, README/runbook.
**Estimated scope:** Medium.

## Task 9: Enforce release gates in CI

**Acceptance criteria:**
- [ ] Lint warnings fail CI.
- [ ] Unit tests and production dependency audit run in CI.
- [ ] Workflow uses least-privilege permissions and the supported toolchain.

**Verification:** action syntax validation and equivalent local commands.

**Dependencies:** Tasks 1-8.
**Files likely touched:** `.github/workflows/frontend.yml`, package scripts.
**Estimated scope:** Small.

## Task 10: Secure persistence boundary

**Acceptance criteria:**
- [ ] The selected product model is explicit: local-only or authenticated owner-scoped remote history.
- [ ] No unauthenticated global write/read policies remain deployable.
- [ ] Persistence errors remain visible/recoverable and never hide local records.

**Verification:** persistence contract tests; schema-policy tests if remote is retained; documented production configuration.

**Dependencies:** User product decision.
**Files likely touched:** persistence module, Supabase migration/schema, README, tests.
**Estimated scope:** Medium.
