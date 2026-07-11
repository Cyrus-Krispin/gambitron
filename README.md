# Gambitron

![Gambitron chess game](frontend/public/readme/gambitron-hero.png)

Gambitron is a browser-based chess game built around a home-grown chess opponent. Choose a time control and a side, play against the engine, and revisit completed games move by move. The game runs entirely in the browser—there is no game server to operate.

[Play Gambitron](https://gambitron.vercel.app)

## What it does

- Lets players face Gambitron as White, Black, or a random side across bullet, blitz, rapid, and classical time controls.
- Validates moves, shows legal destinations, tracks captures, and runs each player's clock locally.
- Plays the engine's reply in the same browser session.
- Saves completed games for the History and Replay views, including each position and move.

## How it is built

Gambitron is a React and TypeScript single-page application built with Vite. The board, controls, routing, clocks, and replay interface all live in the frontend.

`chess.js` supplies legal move generation and game-state rules. A local socket-compatible runtime coordinates game sessions, clock updates, and engine turns without a network WebSocket or backend service.

The opponent uses a browser-local minimax search with alpha-beta pruning. It orders forcing moves such as captures, promotions, and checks, then evaluates positions using material scores calculated by a compact embedded WebAssembly module.

Completed games are stored in Supabase when it is configured and are also retained in `localStorage` as an offline fallback. This keeps history and replay available without requiring an account or a dedicated application server.

## Architecture

![Gambitron architecture](frontend/public/gambitron-architecture.svg)

```text
React interface
  ├─ Board, clocks, move feedback, history, replay
  ├─ chess.js: legal moves and game state
  └─ Local game runtime
       ├─ Minimax + alpha-beta engine
       └─ WebAssembly material evaluation

Game history
  ├─ Supabase, when configured
  └─ localStorage fallback
```

The editable architecture diagram is available at [frontend/public/gambitron-architecture.drawio](frontend/public/gambitron-architecture.drawio).
