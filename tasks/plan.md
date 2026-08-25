# Implementation Plan: Production Readiness

## Overview

Prepare the browser-only Gambitron application for a safe, observable, reproducible production release. Work proceeds in risk-first slices: chess correctness and reload recovery, then responsive/accessibility behavior, then supply-chain and deployment hardening, followed by end-to-end verification and a pull request.

## Architecture Decisions

- Preserve the frontend-only WASM architecture and Vercel hosting model.
- Persist active local games in browser storage so route reloads are recoverable without adding a server.
- Use browser-local history for production. Keep the legacy Supabase schema non-deployable until an authenticated, owner-scoped design is separately approved.
- Use existing dependencies where possible; add no monitoring vendor or backend service without approval.
- Land changes in independently verified commits so every slice is rollback-friendly.

## Task List

### Phase 1: Correctness and Recovery

- [x] Task 1: Correct search behavior while in check and history-table keying.
- [x] Task 2: Preserve promotions and derive accurate game termination reasons.
- [x] Task 3: Persist active local games and recover or reject reloaded routes explicitly.

### Checkpoint: Core Reliability

- [x] Focused regression tests pass.
- [x] Local game smoke and engine-strength gates pass.
- [x] Production build succeeds.

### Phase 2: Product Quality

- [x] Task 4: Make the board and navigation usable at 320px and larger.
- [x] Task 5: Add keyboard-accessible chess, promotion, replay, and live status semantics.
- [x] Task 6: Add resilient routing and top-level error handling.

### Checkpoint: User Flows

- [x] Landing, start, move, reload, history, replay, and not-found flows work; promotion uses a focus-trapped Radix dialog.
- [x] Responsive layout is verified at 320px, 768px, 1024px, and 1440px.

### Phase 3: Release Hardening

- [x] Task 7: Patch vulnerable dependencies and pin the supported toolchain.
- [x] Task 8: Add security headers, metadata, immutable asset caching, and release documentation.
- [x] Task 9: Strengthen CI with warning-free lint, unit tests, dependency audit, least privilege, and a browser smoke gate.
- [x] Task 10: Use a local-only production persistence boundary and disable unsafe anonymous remote storage.

### Checkpoint: Release Candidate

- [x] Clean audit, lint, typecheck, tests, engine gate, build, and browser smoke pass.
- [x] Security headers and route rewrites are configured and included in the preview checklist.
- [x] Multi-axis final review has no unresolved critical or required code findings.
- [x] Rollback and post-deploy verification are documented.
- [x] Branch is pushed and pull request is open against `main` as PR #29.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Existing public Supabase policy permits abuse | High | Do not enable current remote path; require an explicit ownership decision before schema/auth changes |
| `useGame` is a large stateful hook | High | Make behavior-focused, small changes guarded by focused tests; avoid broad refactoring |
| Browser AI blocks the main thread | High | Profile before/after; move search to a worker only with measurable benefit and unchanged engine gate |
| Mobile CSS regressions | Medium | Screenshot and interact at four fixed viewport widths |
| Dependency updates alter engine behavior | Medium | Update in isolated commits and run deterministic engine comparison after each relevant update |

## Release-settings follow-up

GitHub branch protection, required checks, secret scanning, and Vercel promotion policy are repository settings outside this code change. The release owner must enable them using the runbook before production promotion.
