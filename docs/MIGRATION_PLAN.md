# Gambitron Full Migration Plan

**EC2 + WebSocket + Supabase (PostgreSQL) + Game & Move History**

This document is the complete plan to migrate from Lambda/API Gateway to EC2, add WebSocket support, and implement game history with move-by-move storage in Supabase.

---

## 1. Executive Summary

| Current | Target |
|---------|--------|
| AWS Lambda + API Gateway (30s timeout) | EC2 instance (no timeout, persistent connections) |
| REST POST for each AI move | WebSocket for real-time bidirectional communication |
| No game history | Supabase (PostgreSQL) storing games + move history |
| localStorage only for game state | Server-side persistence with full replay support |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Vercel)                               │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────────────┐ │
│  │ Game UI      │  │ WebSocket    │  │ History Page + Replay            │ │
│  │ (React)      │  │ Client       │  │ GET /games, GET /games/:id       │ │
│  └──────────────┘  └──────┬───────┘  └─────────────────────────────────┘ │
└───────────────────────────┼──────────────────────────────────────────────┘
                            │ wss://api.gambitron.xyz
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EC2 INSTANCE                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  FastAPI App (uvicorn)                                              │ │
│  │  ├── REST: /health, /games, /games/:id, /games/:id/moves            │ │
│  │  └── WebSocket: /ws (game + AI moves)                               │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                            │
                            │ Supabase connection string
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE (managed PostgreSQL)                     │
│  ┌─────────────────┐  ┌─────────────────────────────────────────────────┐ │
│  │ games          │  │ moves                                            │ │
│  │ - id            │  │ - id, game_id (FK)                              │ │
│  │ - created_at    │  │ - ply, fen, san, from_square, to_square         │ │
│  │ - ended_at      │  │ - created_at                                    │ │
│  │ - result        │  │ (one row per move, insert-only during game)     │ │
│  │ - time_control  │  └─────────────────────────────────────────────────┘ │
│  └─────────────────┘                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Design (Supabase / PostgreSQL)

### 3.1 Why Supabase?

- **Free tier**: 500 MB database, unlimited API requests
- **Managed**: No DB hosting on EC2; backups, scaling handled by Supabase
- **PostgreSQL**: Robust, ACID, excellent for relational data
- **Moves table**: Append-only inserts per move; game row updated only when game ends

### 3.2 Schema

#### Table: `games`

Stores game metadata. **Updated only when the game ends.**

```sql
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  time_control_ms INTEGER NOT NULL,
  result TEXT,                    -- '1-0', '0-1', '1/2-1/2', null if ongoing
  termination TEXT,               -- 'checkmate', 'timeout', 'stalemate', 'draw', null
  player_color TEXT NOT NULL DEFAULT 'white',
  pgn TEXT,                        -- Full PGN, built at game end (optional, for export)
  metadata JSONB DEFAULT '{}'      -- client_id, user_agent, etc. for future auth
);

CREATE INDEX idx_games_created_at ON games(created_at DESC);
CREATE INDEX idx_games_ended_at ON games(ended_at DESC) WHERE ended_at IS NOT NULL;
```

#### Table: `moves`

One row per move. **Insert-only during the game.** No updates.

```sql
CREATE TABLE moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  ply INTEGER NOT NULL,            -- 1, 2, 3... (half-move count)
  fen TEXT NOT NULL,               -- Position after this move
  san TEXT NOT NULL,               -- Standard algebraic: "e4", "Nf3", "O-O"
  from_square TEXT,                -- "e2", "g1"
  to_square TEXT,                  -- "e4", "f3"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, ply)
);

CREATE INDEX idx_moves_game_id ON moves(game_id);
CREATE INDEX idx_moves_game_ply ON moves(game_id, ply);
```

### 3.3 Data Flow

| Event | Action |
|-------|--------|
| Game starts | `INSERT` into `games` (ended_at, result, termination = null) |
| Player moves | `INSERT` into `moves` (ply, fen, san, from_square, to_square) |
| AI moves | `INSERT` into `moves` (same) |
| Game ends | `UPDATE` games SET ended_at, result, termination, pgn |

### 3.4 Replay Query

```sql
SELECT ply, fen, san, from_square, to_square
FROM moves
WHERE game_id = $1
ORDER BY ply ASC;
```

---

## 4. WebSocket Protocol

### 4.1 Connection

`wss://api.gambitron.xyz/ws`

### 4.2 Client → Server Messages (JSON)

| Type | Payload | Description |
|------|---------|-------------|
| `start_game` | `{ timeControlMs, playerColor }` | Start new game; server creates game row, returns gameId |
| `player_move` | `{ gameId, fen, san?, from?, to? }` | Human played; server inserts move, runs AI, inserts AI move, returns |
| `promotion_move` | `{ gameId, fen, from, to, promotion }` | After promotion; same flow as player_move |
| `ping` | `{}` | Keepalive |

### 4.3 Server → Client Messages (JSON)

| Type | Payload | Description |
|------|---------|-------------|
| `game_started` | `{ gameId, fen, timeControlMs }` | Game created and ready |
| `ai_move` | `{ updatedFen, result, san, fromSquare, toSquare }` | AI response |
| `game_ended` | `{ gameId, result, termination }` | Game over |
| `error` | `{ message }` | Error |
| `pong` | `{}` | Keepalive response |

### 4.4 Move Persistence in WebSocket Flow

1. Client sends `player_move` with `{ gameId, fen }`.
2. Server inserts player move into `moves` (infer san/from/to from fen diff if needed).
3. Server runs AI (thread pool), gets `updated_fen`, `result`.
4. Server inserts AI move into `moves`.
5. Server sends `ai_move` to client.
6. If `result !== "*"`, server `UPDATE`s `games` (ended_at, result, termination), sends `game_ended`.

---

## 5. REST API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/games` | List games (paginated). Query: `?limit=20&offset=0` |
| GET | `/games/:id` | Single game with metadata |
| GET | `/games/:id/moves` | All moves for a game (for replay) |

### Response Examples

**GET /games**
```json
{
  "games": [
    {
      "id": "uuid",
      "created_at": "2025-03-06T12:00:00Z",
      "ended_at": "2025-03-06T12:15:00Z",
      "time_control_ms": 300000,
      "result": "1-0",
      "termination": "checkmate",
      "player_color": "white",
      "move_count": 42
    }
  ],
  "total": 150
}
```

**GET /games/:id/moves**
```json
{
  "moves": [
    { "ply": 1, "fen": "...", "san": "e4", "from_square": "e2", "to_square": "e4" },
    { "ply": 2, "fen": "...", "san": "e5", "from_square": "e7", "to_square": "e5" }
  ]
}
```

---

## 6. Implementation Phases

### Phase 1: EC2 + FastAPI + Supabase Setup

1. Create Supabase project at supabase.com.
2. Run the schema SQL in Supabase SQL Editor (games + moves tables).
3. Copy Supabase connection string (Settings → Database → Connection string).
4. Provision EC2 (t3.small, Ubuntu 22.04).
5. Install Python 3.11+, FastAPI, uvicorn, chess, asyncpg (or psycopg2).
6. Port `backend.py` logic to new `backend/` structure.
7. Add Supabase/PostgreSQL connection; env var `DATABASE_URL`.
8. Configure Nginx/Caddy + SSL (Let's Encrypt).
9. Point `VITE_backend` to `https://api.gambitron.xyz`.
10. Verify REST `/` (FEN → AI move) still works.

### Phase 2: Game & Move Persistence

1. Add `POST /games` to create game (returns `gameId`). Optional: can be done via WebSocket only.
2. Implement `insert_move(game_id, ply, fen, san, from_square, to_square)`.
3. Implement `update_game_ended(game_id, result, termination)`.
4. Add `GET /games` and `GET /games/:id` and `GET /games/:id/moves`.
5. Integrate persistence into existing REST flow (for testing): after each AI move, if game ends, update game. For full move history, need to track gameId and insert each move — easier to do in Phase 3 with WebSocket.

### Phase 3: WebSocket

1. Add WebSocket route `/ws` in FastAPI.
2. Implement handlers: `start_game`, `player_move`, `promotion_move`, `ping`.
3. On `start_game`: INSERT game, return `game_started` with gameId.
4. On `player_move`: INSERT player move, run AI in thread pool, INSERT AI move, send `ai_move`. If game over, UPDATE game, send `game_ended`.
5. Update frontend: WebSocket client in `useGame.ts`, replace `callAIMove` fetch with WS `player_move`.
6. Add reconnection logic and error handling.
7. Set `VITE_WS_URL` in frontend env.

### Phase 4: Game History UI

1. Add `/history` route in frontend.
2. Create `useGameHistory` hook: fetch `GET /games`.
3. Create `History.tsx` page: list games (date, result, time control, link to replay).
4. Add `GET /games/:id/moves` fetch for replay.
5. Create replay component: step through moves, display board at each position.
6. Optional: Pagination, filters (result, date range).

---

## 7. Backend File Structure

```
backend/
├── main.py                 # FastAPI app, CORS, routes
├── chess_engine.py         # get_best_move, evaluate, minimax (from backend.py)
├── config.py               # Settings (DATABASE_URL, etc.)
├── db/
│   ├── __init__.py
│   ├── connection.py       # Supabase/PostgreSQL connection pool
│   ├── games.py            # create_game, get_game, list_games, update_game_ended
│   └── moves.py            # insert_move, get_moves_by_game
├── websocket/
│   ├── __init__.py
│   └── handlers.py         # handle_start_game, handle_player_move, etc.
├── routes/
│   ├── __init__.py
│   ├── games.py            # GET /games, GET /games/:id, GET /games/:id/moves
│   └── health.py           # GET /health
├── requirements.txt
└── Dockerfile              # Optional
```

### requirements.txt

```
fastapi
uvicorn[standard]
chess
asyncpg          # or psycopg[binary] for sync
python-dotenv
```

---

## 8. Frontend File Structure

```
frontend/src/
├── hooks/
│   ├── useGame.ts          # Update: WebSocket instead of fetch
│   └── useGameHistory.ts   # New: fetch games, fetch moves for replay
├── lib/
│   └── websocket.ts        # New: WebSocket client, reconnect logic
├── pages/
│   ├── Game.tsx            # Existing
│   └── History.tsx         # New: game list + replay
├── App.tsx                 # Add /history route
└── ...
```

---

## 9. Deployment Checklist

### Supabase

- [ ] Create project
- [ ] Run schema SQL (games, moves tables)
- [ ] Copy connection string (URI format for asyncpg/psycopg)
- [ ] Add connection string to EC2 env as `DATABASE_URL`

### EC2

- [ ] Launch EC2 (t3.small, Ubuntu 22.04)
- [ ] Security group: 22 (SSH), 80, 443
- [ ] Elastic IP (optional)
- [ ] Domain: api.gambitron.xyz → Elastic IP

### App (EC2)

- [ ] Install Python, dependencies
- [ ] Systemd service for uvicorn (auto-restart)
- [ ] Nginx/Caddy reverse proxy + SSL (Let's Encrypt)
- [ ] Environment: `DATABASE_URL`, `ALLOWED_ORIGINS`

### Frontend (Vercel)

- [ ] `VITE_backend` → `https://api.gambitron.xyz`
- [ ] `VITE_WS_URL` → `wss://api.gambitron.xyz/ws`

---

## 10. Cost Estimate

| Resource | Monthly |
|----------|---------|
| EC2 t3.small | ~$15 |
| EBS 30 GB | ~$3 |
| Supabase | $0 (free tier) |
| Domain | ~$1 |
| **Total** | **~$19/month** |

---

## 11. Environment Variables

### Backend (EC2)

```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
ALLOWED_ORIGINS=https://gambitron.vercel.app,http://localhost:5173
```

### Frontend (Vercel)

```
VITE_backend=https://api.gambitron.xyz
VITE_WS_URL=wss://api.gambitron.xyz/ws
```

---

## 12. Future Considerations

- **Auth**: Supabase Auth; add `user_id` to games, filter history by user.
- **PvP**: WebSocket broadcast between two players; same moves table.
- **PGN export**: Build PGN from moves table when game ends; store in `games.pgn`.
- **Scaling**: ALB + multiple EC2; Supabase handles DB scaling.

---

## Summary

1. **EC2**: Host FastAPI + WebSocket; no API Gateway timeout.
2. **Supabase**: Managed PostgreSQL; free tier; games + moves tables.
3. **Moves table**: One row per move, insert-only; game row updated only at end.
4. **WebSocket**: Real-time AI moves; persistence on each move.
5. **History UI**: List games, replay from moves.

**Phase order**: 1) EC2 + Supabase + REST → 2) Persistence → 3) WebSocket → 4) History UI.
