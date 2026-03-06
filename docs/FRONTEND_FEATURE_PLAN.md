# Gambitron Frontend — Feature Plan (for Rewrite)

This document captures **what the app does** (features and user-facing behavior), not how it's implemented. Use this as the spec when rewriting the frontend.

---

## 1. Core Gameplay

| Feature | Description |
|---------|-------------|
| **Play vs AI** | Human plays White, AI (Gambitron) plays Black. Turn-based. |
| **Click-to-move** | Click piece → click destination. No drag-and-drop. |
| **Legal move validation** | Only legal moves are allowed. Invalid clicks are ignored or switch selection. |
| **Move feedback** | Selected square is visually highlighted. Valid destination squares show indicators (e.g. dots). |
| **Piece selection** | Click same square to deselect. Click another own piece to switch selection. |
| **Pawn promotion** | When a white pawn reaches the 8th rank, user must choose: Queen, Rook, Bishop, or Knight. |

---

## 2. Timing System

| Feature | Description |
|---------|-------------|
| **Dual timers** | Separate countdown clocks for Player and AI. |
| **Configurable time control** | User picks before game: 1 min, 3 min, 5 min, 10 min, 15 min, or 10 seconds. |
| **Player clock** | Runs only on player's turn (when it's White to move and AI is not thinking). |
| **AI clock** | Runs only while AI is thinking. |
| **Timeout = loss** | If a player's time hits 0, they lose. Game ends immediately. |
| **Timer persistence** | Clocks persist in localStorage across page reloads. |
| **Active turn indicator** | Visual cue (e.g. green dot/highlight) showing whose turn it is. |

---

## 3. Game Lifecycle

| Feature | Description |
|---------|-------------|
| **Start game flow** | Before first move, user must see a "Start New Game" dialog and choose time control. Cannot play until they click Start. |
| **New Game** | Button resets board, clocks, and state. Opens the Start dialog again to pick time control. |
| **Game persistence** | Board position (FEN) and both clocks saved to localStorage. Resuming from a saved state is supported. |
| **Endgame detection** | Checkmate, stalemate, draw, timeout. |

---

## 4. Dialogs & Modals

| Feature | Description |
|---------|-------------|
| **Start Game dialog** | Modal on first load or after New Game. Time control selector (1, 3, 5, 10, 15 min, 10s). Start button. Cannot be dismissed without starting. |
| **Pawn promotion dialog** | Modal when promoting. Four options: Queen, Rook, Bishop, Knight. Cancel option. |
| **Endgame dialog** | Shows result: "You Win", "You Lose", or "Draw". Explains reason (checkmate, timeout). "New Game" button. Can be closed (X) to view final position. |
| **Error notification** | Snackbar/toast when backend fails. Optional "Retry" button if the failed request can be retried. Auto-dismiss after a few seconds. |

---

## 5. Layout & Responsiveness

| Feature | Description |
|---------|-------------|
| **Desktop layout** | Three areas: left sidebar, center board, right sidebar. |
| **Mobile layout** | Stacked: AI timer top, board center, player timer + New Game bottom. |
| **Breakpoint** | Switch between desktop and mobile at ~1024px (lg). |
| **Responsive board** | Board size adapts to viewport (smaller on mobile, larger on desktop). |
| **Board overlay** | When Start dialog is open, board is dimmed and non-interactive. |

---

## 6. Desktop Left Sidebar

| Feature | Description |
|---------|-------------|
| **Social links** | GitHub, LinkedIn, LeetCode. Icon links that open in new tab. |
| **Game info** | Time control label (e.g. "5 min • Blitz"), "vs Gambitron". |
| **Turn indicator** | "Your turn" or "AI turn" with visual dot. |
| **New Game button** | Starts new game flow. |

---

## 7. Desktop Right Sidebar

| Feature | Description |
|---------|-------------|
| **AI timer** | Large countdown (MM:SS). Label "Gambitron". Active state when AI's turn. |
| **Player timer** | Large countdown (MM:SS). Label "You". Active state when player's turn. |

---

## 8. Mobile-Specific

| Feature | Description |
|---------|-------------|
| **AI timer** | Top bar. Same format as desktop. |
| **Player timer** | Bottom bar. Same format. |
| **New Game button** | Below player timer. |

---

## 9. Admin Panel (Hidden Route)

| Feature | Description |
|---------|-------------|
| **Route** | `/admin` — separate from main `/` route. |
| **FEN loader** | Text input for FEN string. "Load Position" button. |
| **Example FENs** | Quick-fill buttons: Starting position, Mid-game, King vs King. |
| **Behavior** | Loads arbitrary position. If Black to move, AI responds immediately. Timers disabled. |
| **Layout** | Two columns (no right timer sidebar). |

---

## 10. Backend Integration

### API Contract

| Aspect | Details |
|--------|---------|
| **Endpoint** | `POST {VITE_backend}?value={FEN}` |
| **Method** | POST |
| **FEN encoding** | Passed as query parameter `value`. Must be URL-encoded. |
| **Headers** | `Content-Type: application/json` (body is empty; FEN is in query) |
| **Response (200)** | JSON: `{ "updated_fen": string, "result": string }` |
| **Response (400)** | Invalid FEN or no legal moves. Error detail in response body. |

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `updated_fen` | string | Board position after AI's move. Load this into chess.js to update the board. |
| `result` | string | Game result: `"1-0"` (White wins), `"0-1"` (Black wins), `"1/2-1/2"` (draw), or `"*"` (game continues). |

### Backend Behavior

- **Input**: Valid FEN string. Backend expects **Black to move** (human plays White, so after each human move it's Black's turn).
- **AI logic**: Minimax with alpha-beta pruning, depth 3. Evaluates material, piece-square tables, pawn structure, etc.
- **Game over**: If position is already checkmate/stalemate/draw, backend returns same FEN and the result.
- **No moves**: If Black has no legal moves (shouldn't happen in normal play), backend returns 400.

### Frontend Integration Flow

1. **When to call**: After every human move (or after promotion). Also when loading a FEN in admin mode with Black to move.
2. **Request**: `POST {baseUrl}?value=${encodeURIComponent(fen)}`
3. **On success**: Load `data.updated_fen` into chess.js, update board state, persist to localStorage. If `data.result !== "*"`, show endgame dialog.
4. **On error**: Show error snackbar. Store last FEN for retry; if user clicks Retry, re-send same request.
5. **Cancellation**: Use `AbortController`. Abort when: user clicks New Game, or AI times out while thinking.

### Environment

| Variable | Description |
|----------|-------------|
| `VITE_backend` | Base URL of the backend (e.g. `https://xxx.execute-api.region.amazonaws.com/prod` for Lambda, or `http://localhost:8000` for local FastAPI). |

### Deployments

- **Local dev**: `fastapi dev backend.py` → typically `http://localhost:8000`
- **Production**: AWS Lambda behind API Gateway. POST to root path with `value` in query string.
- **CORS**: Backend allows `*` origins. No auth required.

---

## 11. Assets & Data

| Feature | Description |
|---------|-------------|
| **Piece SVGs** | `/pieces/` — one SVG per piece+color (e.g. `q-white.svg`, `k-black.svg`). |
| **Social icons** | `/github.svg`, `/linkedin.svg`, `/leetcode.svg`. |

---

## 12. Misc

| Feature | Description |
|---------|-------------|
| **Analytics** | Vercel Analytics (keep if desired). |
| **Theme** | Dark theme (gray-800/900 backgrounds). |
| **Time control labels** | Bullet (<3 min), Blitz (<10 min), Rapid (<30 min), Classical (30+ min). |

---

## Summary Checklist for Rewrite

- [ ] Chess board with click-to-move
- [ ] Legal move validation and highlighting
- [ ] Pawn promotion (Queen, Rook, Bishop, Knight)
- [ ] Dual timers (player + AI) with configurable time control
- [ ] Start Game dialog (time control selection)
- [ ] Endgame dialog (win/lose/draw + reason)
- [ ] Error snackbar with retry
- [ ] Desktop layout (left sidebar, board, right sidebar)
- [ ] Mobile layout (stacked)
- [ ] Social links (GitHub, LinkedIn, LeetCode)
- [ ] New Game button
- [ ] Game state persistence (FEN + clocks in localStorage)
- [ ] Admin route with FEN loader
- [ ] Backend API integration
- [ ] Responsive board sizing
