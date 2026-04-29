# Gambitron

<div align="center">

![Gambitron Demo](frontend/public/readme/readme-gif-gambitron.gif)

[![Play vs Gambitron](https://img.shields.io/badge/PLAY_VS_GAMBITRON-000?style=for-the-badge&labelColor=FFF&color=000)](https://gambitron.vercel.app)

**Chess AI built with React, FastAPI, and WebSockets**

[![React](https://img.shields.io/badge/React_18-blue?logo=react&logoColor=white)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript_5-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python_3-green?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-teal?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)

</div>

---

## Features

- Play as White or Black against a minimax AI (depth 3, α/β pruning)
- Server-authoritative clocks with configurable time controls
- Full game history and move-by-move replay via PGN
- Reconnection support — drop and rejoin mid-game

## How It Works

```
React (Vercel) ←——WebSocket——→ FastAPI (EC2) ←——→ PostgreSQL
```

The frontend communicates over a persistent WebSocket. The server runs the AI on a thread pool, owns the clocks (100 ms tick), and persists games as PGN. A REST API (`GET /games`, `GET /games/:id/moves`) powers the history and replay pages.

**AI evaluation factors:** material values, piece-square tables, center control, pawn advancement, bishop pair bonus, rook mobility, king safety.

## Quick Start

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
fastapi dev main.py
```

## License

MIT
