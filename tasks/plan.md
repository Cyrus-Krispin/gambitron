# Implementation Plan: Production Readiness

## Overview

Prepare the browser-only Gambitron application for a safe, observable, reproducible production release. Work proceeds in risk-first slices: chess correctness and reload recovery, then responsive/accessibility behavior, then supply-chain and deployment hardening, followed by end-to-end verification and a pull request.

## Architecture Decisions

- Preserve the frontend-only WASM architecture and Vercel hosting model.
- Persist active local games in browser storage so route reloads are recoverable without adding a server.
- Treat the current public Supabase schema as unsafe to enable. Keep remote persistence disabled until the owner chooses authenticated, owner-scoped history or an explicitly local-only product.
- Use existing dependencies where possible; add no monitoring vendor or backend service without approval.
- Land changes in independently verified commits so every slice is rollback-friendly.

## Task List

### Phase 1: Correctness and Recovery

- [ ] Task 1: Correct search behavior while in check and history-table keying.
- [ ] Task 2: Preserve promotions and derive accurate game termination reasons.
- [ ] Task 3: Persist active local games and recover or reject reloaded routes explicitly.

### Checkpoint: Core Reliability

- [ ] Focused regression tests pass.
- [ ] Local game smoke and engine-strength gates pass.
- [ ] Production build succeeds.

### Phase 2: Product Quality

- [ ] Task 4: Make the board and navigation usable at 320px and larger.
- [ ] Task 5: Add keyboard-accessible chess, promotion, replay, and live status semantics.
- [ ] Task 6: Add resilient routing and top-level error handling.

### Checkpoint: User Flows

- [ ] Landing, start, move, promotion, reload, history, replay, and not-found flows work.
- [ ] Browser console is clean at 320px, 768px, 1024px, and 1440px.

### Phase 3: Release Hardening

- [ ] Task 7: Remove or patch vulnerable dependencies and pin the supported toolchain.
- [ ] Task 8: Add security headers, metadata, immutable asset caching, and environment documentation.
- [ ] Task 9: Strengthen CI with warning-free lint, unit tests, dependency audit, least privilege, and a browser smoke gate.
- [ ] Task 10: Resolve the Supabase product decision and implement the chosen safe boundary.

### Checkpoint: Release Candidate

- [ ] Clean install, audit, lint, typecheck, tests, engine gate, and build all pass.
- [ ] Security headers and route rewrites are verified against a local/preview deployment.
- [ ] Multi-axis final review has no unresolved critical or required findings.
- [ ] Rollback and post-deploy verification are documented.
- [ ] Branch is pushed and pull request is open against `main`.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Existing public Supabase policy permits abuse | High | Do not enable current remote path; require an explicit ownership decision before schema/auth changes |
| `useGame` is a large stateful hook | High | Make behavior-focused, small changes guarded by focused tests; avoid broad refactoring |
| Browser AI blocks the main thread | High | Profile before/after; move search to a worker only with measurable benefit and unchanged engine gate |
| Mobile CSS regressions | Medium | Screenshot and interact at four fixed viewport widths |
| Dependency updates alter engine behavior | Medium | Update in isolated commits and run deterministic engine comparison after each relevant update |

## Open Questions

- Should saved history remain browser-local, or should Gambitron add Supabase anonymous authentication with owner-scoped rows? The current unauthenticated global read/write schema will not be enabled as-is.
- May the unused `MermaidDiagram` component and Mermaid dependency be removed? They have no callers and account for most reported runtime dependency advisories.

